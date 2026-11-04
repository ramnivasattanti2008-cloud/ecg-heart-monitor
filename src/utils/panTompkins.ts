// Pan-Tompkins Algorithm for QRS / R-Peak Detection
// Plus Wave Fiducial Extraction (P, Q, R, S, T) and Clinical Interval Estimation

import { biquadHighpass, biquadLowpass, applyBiquad, removeBaselineWander } from './biquadFilters';
import type { WaveFiducials, SignalQualityIndex } from '../types/ecg';

function mean(arr: number[] | Float64Array): number {
  if (!arr.length) return 0;
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

function stddev(arr: number[] | Float64Array): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  let ss = 0;
  for (let i = 0; i < arr.length; i++) {
    const diff = arr[i] - m;
    ss += diff * diff;
  }
  return Math.sqrt(ss / (arr.length - 1));
}

/**
 * Pan-Tompkins QRS detection algorithm:
 * 1. Bandpass filter (5 - 15 Hz)
 * 2. Five-point derivative
 * 3. Squaring
 * 4. Moving-window integration (~150 ms)
 * 5. Adaptive dual-thresholding with search-back
 * 6. True peak refinement on original ECG
 */
export function detectRPeaksPanTompkins(signal: number[] | Float64Array, fs: number): number[] {
  const n = signal.length;
  if (n < Math.round(fs * 0.5)) return []; // Need at least 0.5s

  // 1. Band-pass 5 - 15 Hz
  let bp = applyBiquad(signal, biquadHighpass(5, fs));
  bp = applyBiquad(bp, biquadLowpass(15, fs));

  // 2. Five-point derivative (emphasizes steep QRS slope)
  const der = new Float64Array(n);
  for (let i = 2; i < n - 2; i++) {
    der[i] = (2 * bp[i + 1] + bp[i + 2] - bp[i - 2] - 2 * bp[i - 1]) * (fs / 8);
  }

  // 3. Squaring (rectify + nonlinearly amplify large values)
  const sq = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    sq[i] = der[i] * der[i];
  }

  // 4. Moving-window integration (~150 ms)
  const w = Math.max(1, Math.round(0.15 * fs));
  const mwi = new Float64Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += sq[i];
    if (i >= w) acc -= sq[i - w];
    mwi[i] = acc / Math.min(i + 1, w);
  }

  // 5. Adaptive dual-thresholding with search-back
  const learnWindow = Math.min(n, Math.round(2 * fs));
  let mx = 0;
  let sum = 0;
  for (let i = 0; i < learnWindow; i++) {
    sum += mwi[i];
    if (mwi[i] > mx) mx = mwi[i];
  }

  let spki = mx * 0.25 || 1e-6;                    // running signal peak estimate
  let npki = (sum / Math.max(1, learnWindow)) * 0.5 || 1e-9; // running noise estimate
  let thr1 = npki + 0.25 * (spki - npki);
  let thr2 = 0.5 * thr1;

  const refractory = Math.round(0.2 * fs);         // 200 ms physiological blanking period
  const fiducials: number[] = [];
  const rrHistory: number[] = [];
  let rrMean = 0;
  let lastPeakIndex = -Infinity;
  let bestSubThreshold: { idx: number; val: number } | null = null;

  const registerBeat = (idx: number) => {
    if (fiducials.length > 0) {
      const interval = idx - lastPeakIndex;
      rrHistory.push(interval);
      if (rrHistory.length > 8) rrHistory.shift();
      rrMean = mean(rrHistory);
    }
    fiducials.push(idx);
    lastPeakIndex = idx;
  };

  for (let i = 1; i < n - 1; i++) {
    // Check local maximum in integrated signal
    if (!(mwi[i] > mwi[i - 1] && mwi[i] >= mwi[i + 1])) continue;

    const peakVal = mwi[i];

    if (peakVal > thr1 && (i - lastPeakIndex) > refractory) {
      registerBeat(i);
      spki = 0.125 * peakVal + 0.875 * spki;
      bestSubThreshold = null;
    } else {
      npki = 0.125 * peakVal + 0.875 * npki;
      if (peakVal > thr2 && (i - lastPeakIndex) > refractory && (!bestSubThreshold || peakVal > bestSubThreshold.val)) {
        bestSubThreshold = { idx: i, val: peakVal };
      }
      // Search-back: if beat is overdue (> 1.66 * RR_mean), accept best subthreshold candidate
      if (rrMean > 0 && (i - lastPeakIndex) > Math.round(1.66 * rrMean) && bestSubThreshold) {
        registerBeat(bestSubThreshold.idx);
        spki = 0.25 * bestSubThreshold.val + 0.75 * spki;
        bestSubThreshold = null;
      }
    }
    thr1 = npki + 0.25 * (spki - npki);
    thr2 = 0.5 * thr1;
  }

  // 6. Refine peak location on baseline-removed ECG signal
  const cleaned = removeBaselineWander(signal, fs, 0.3);
  const searchBackWindow = Math.round(0.18 * fs) + w;
  const refinedPeaks: number[] = [];
  let prevAdded = -1;

  for (const fid of fiducials) {
    const startIdx = Math.max(0, fid - searchBackWindow);
    const endIdx = Math.min(n - 1, fid + Math.round(0.04 * fs));
    let bestIdx = startIdx;
    let bestVal = -Infinity;

    for (let j = startIdx; j <= endIdx; j++) {
      if (cleaned[j] > bestVal) {
        bestVal = cleaned[j];
        bestIdx = j;
      }
    }

    if (bestIdx !== prevAdded && (prevAdded === -1 || bestIdx - prevAdded > Math.round(0.18 * fs))) {
      refinedPeaks.push(bestIdx);
      prevAdded = bestIdx;
    }
  }

  return refinedPeaks;
}

/** Adaptive amplitude fallback detector for low sampling rates or short signals */
export function detectRPeaksFallback(signal: number[] | Float64Array, fs: number): number[] {
  const cleaned = removeBaselineWander(signal, fs, 0.2);
  let mx = -Infinity;
  let mn = Infinity;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] > mx) mx = cleaned[i];
    if (cleaned[i] < mn) mn = cleaned[i];
  }
  const avg = mean(cleaned);
  const std = stddev(cleaned);
  const threshold = Math.max(avg + 1.2 * std, 0.4 * mx);
  const refractory = Math.round(0.22 * fs);
  const peaks: number[] = [];
  let last = -Infinity;

  for (let i = 1; i < cleaned.length - 1; i++) {
    if (cleaned[i] > threshold && cleaned[i] >= cleaned[i - 1] && cleaned[i] > cleaned[i + 1]) {
      if (i - last >= refractory) {
        peaks.push(i);
        last = i;
      } else if (peaks.length && cleaned[i] > cleaned[peaks[peaks.length - 1]]) {
        peaks[peaks.length - 1] = i;
        last = i;
      }
    }
  }
  return peaks;
}

/** Master R-peak detection selector */
export function detectRPeaks(signal: number[] | Float64Array, fs: number): number[] {
  if (fs >= 45 && signal.length >= fs) {
    const ptPeaks = detectRPeaksPanTompkins(signal, fs);
    if (ptPeaks.length >= 2) return ptPeaks;
  }
  return detectRPeaksFallback(signal, fs);
}

/** Extract P, Q, R, S, T fiducial points around detected R-peaks */
export function extractFiducials(
  signal: number[] | Float64Array, 
  rPeaks: number[], 
  fs: number
): WaveFiducials[] {
  const n = signal.length;
  const fiducials: WaveFiducials[] = [];

  for (const rIdx of rPeaks) {
    const rTime = rIdx / fs;
    const rAmp = signal[rIdx];

    const fid: WaveFiducials = {
      rIndex: rIdx,
      rTime,
      rAmp,
    };

    // 1. Q-Wave: local minimum 15 - 60 ms before R-peak
    const qStart = Math.max(0, rIdx - Math.round(0.06 * fs));
    const qEnd = Math.max(0, rIdx - Math.round(0.015 * fs));
    if (qEnd > qStart) {
      let minVal = Infinity;
      let minIdx = qStart;
      for (let i = qStart; i <= qEnd; i++) {
        if (signal[i] < minVal) {
          minVal = signal[i];
          minIdx = i;
        }
      }
      fid.qIndex = minIdx;
      fid.qTime = minIdx / fs;
      fid.qAmp = minVal;
    }

    // 2. S-Wave: local minimum 15 - 70 ms after R-peak
    const sStart = Math.min(n - 1, rIdx + Math.round(0.015 * fs));
    const sEnd = Math.min(n - 1, rIdx + Math.round(0.07 * fs));
    if (sEnd > sStart) {
      let minVal = Infinity;
      let minIdx = sStart;
      for (let i = sStart; i <= sEnd; i++) {
        if (signal[i] < minVal) {
          minVal = signal[i];
          minIdx = i;
        }
      }
      fid.sIndex = minIdx;
      fid.sTime = minIdx / fs;
      fid.sAmp = minVal;
    }

    // 3. P-Wave: local maximum 100 - 240 ms before Q or R
    const pRef = fid.qIndex ?? rIdx;
    const pStart = Math.max(0, pRef - Math.round(0.24 * fs));
    const pEnd = Math.max(0, pRef - Math.round(0.08 * fs));
    if (pEnd > pStart) {
      let maxVal = -Infinity;
      let maxIdx = pStart;
      for (let i = pStart; i <= pEnd; i++) {
        if (signal[i] > maxVal) {
          maxVal = signal[i];
          maxIdx = i;
        }
      }
      fid.pIndex = maxIdx;
      fid.pTime = maxIdx / fs;
      fid.pAmp = maxVal;
    }

    // 4. T-Wave: local maximum 120 - 400 ms after S or R
    const tRef = fid.sIndex ?? rIdx;
    const tStart = Math.min(n - 1, tRef + Math.round(0.10 * fs));
    const tEnd = Math.min(n - 1, tRef + Math.round(0.38 * fs));
    if (tEnd > tStart) {
      let maxVal = -Infinity;
      let maxIdx = tStart;
      for (let i = tStart; i <= tEnd; i++) {
        if (signal[i] > maxVal) {
          maxVal = signal[i];
          maxIdx = i;
        }
      }
      fid.tIndex = maxIdx;
      fid.tTime = maxIdx / fs;
      fid.tAmp = maxVal;
    }

    fiducials.push(fid);
  }

  return fiducials;
}

/** Calculate clinical ECG intervals: PR, QRS width, QT, and QTc (Bazett) */
export function calculateIntervals(fiducials: WaveFiducials[], meanRRMs: number) {
  if (!fiducials.length) return {};

  const prList: number[] = [];
  const qrsList: number[] = [];
  const qtList: number[] = [];

  for (const f of fiducials) {
    if (f.pTime !== undefined && f.qTime !== undefined) {
      const pr = (f.qTime - f.pTime) * 1000;
      if (pr >= 80 && pr <= 350) prList.push(pr);
    }
    if (f.qTime !== undefined && f.sTime !== undefined) {
      const qrs = (f.sTime - f.qTime) * 1000;
      if (qrs >= 40 && qrs <= 200) qrsList.push(qrs);
    }
    if (f.qTime !== undefined && f.tTime !== undefined) {
      const qt = (f.tTime - f.qTime) * 1000;
      if (qt >= 200 && qt <= 600) qtList.push(qt);
    }
  }

  const prIntervalMs = prList.length ? mean(prList) : undefined;
  const qrsDurationMs = qrsList.length ? mean(qrsList) : undefined;
  const qtIntervalMs = qtList.length ? mean(qtList) : undefined;

  let qtcMs: number | undefined;
  if (qtIntervalMs && meanRRMs > 0) {
    // Bazett formula: QTc = QT / sqrt(RR in seconds)
    const rrSec = meanRRMs / 1000;
    qtcMs = qtIntervalMs / Math.sqrt(rrSec);
  }

  return {
    prIntervalMs,
    qrsDurationMs,
    qtIntervalMs,
    qtcMs,
  };
}

/** Compute Signal Quality Index (SQI) */
export function evaluateSignalQuality(
  signal: number[] | Float64Array, 
  fs: number, 
  rPeaks: number[]
): SignalQualityIndex {
  const n = signal.length;
  const notes: string[] = [];

  // Check for saturation/clipping
  let minVal = Infinity;
  let maxVal = -Infinity;
  for (let i = 0; i < n; i++) {
    if (signal[i] < minVal) minVal = signal[i];
    if (signal[i] > maxVal) maxVal = signal[i];
  }
  const dynamicRange = maxVal - minVal;
  let flatCount = 0;
  for (let i = 1; i < n; i++) {
    if (Math.abs(signal[i] - signal[i - 1]) < 1e-8) flatCount++;
  }
  const clippingDetected = (flatCount / n) > 0.08 || dynamicRange < 0.05;
  if (clippingDetected) {
    notes.push('Signal saturation or sensor disconnection detected');
  }

  // Baseline stability
  const baseline = removeBaselineWander(signal, fs, 0.4);
  let driftSum = 0;
  for (let i = 0; i < n; i++) {
    driftSum += Math.abs(signal[i] - baseline[i]);
  }
  const avgDrift = driftSum / n;
  const baselineStability = Math.max(0, Math.min(100, Math.round((1 - Math.min(1, (avgDrift / (dynamicRange || 1)) * 2)) * 100)));

  // Estimated SNR (QRS energy vs noise in quiet intervals)
  let qrsEnergy = 0;
  let noiseEnergy = 0;
  const qrsWindow = Math.round(0.08 * fs);

  for (let i = 0; i < n; i++) {
    const isQrs = rPeaks.some((p) => Math.abs(i - p) <= qrsWindow);
    const val = baseline[i] * baseline[i];
    if (isQrs) {
      qrsEnergy += val;
    } else {
      noiseEnergy += val;
    }
  }

  const noiseMean = noiseEnergy / Math.max(1, n - rPeaks.length * (2 * qrsWindow));
  const signalMean = qrsEnergy / Math.max(1, rPeaks.length * (2 * qrsWindow));
  const snr = noiseMean > 0 ? signalMean / noiseMean : 100;
  const snrDb = Math.max(-10, Math.min(40, 10 * Math.log10(Math.max(0.1, snr))));

  // Overall Score
  let score = 50;
  if (rPeaks.length >= 2) score += 20;
  if (baselineStability > 70) score += 15;
  if (snrDb > 10) score += 15;
  if (clippingDetected) score -= 35;
  score = Math.max(10, Math.min(99, score));

  let status: 'excellent' | 'good' | 'marginal' | 'poor' = 'good';
  if (score >= 85) status = 'excellent';
  else if (score >= 70) status = 'good';
  else if (score >= 50) status = 'marginal';
  else status = 'poor';

  if (rPeaks.length < 2) notes.push('Insufficient R-peaks detected for full analysis');
  if (baselineStability < 60) notes.push('Significant respiration baseline drift present');
  if (snrDb < 6) notes.push('High-frequency EMG or mains noise detected');

  return {
    overallScore: score,
    status,
    snrDb: Number(snrDb.toFixed(1)),
    baselineStability,
    clippingDetected,
    notes: notes.length ? notes : ['Normal signal quality, reliable R-peak morphology'],
  };
}
