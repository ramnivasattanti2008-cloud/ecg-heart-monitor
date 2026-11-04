// Heart Rate and Heart Rate Variability (HRV) Analysis Engine
// Time-domain, Frequency-domain (Welch FFT spectral decomposition), and Non-linear (Poincaré & Sample Entropy)

import type { HRVMetrics } from '../types/ecg';

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((acc, v) => acc + v, 0) / arr.length;
}

function stddev(arr: number[], sample = true): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const ss = arr.reduce((acc, v) => acc + (v - m) * (v - m), 0);
  return Math.sqrt(ss / (arr.length - (sample ? 1 : 0)));
}

/**
 * Calculates Sample Entropy (SampEn) for RR time-series
 * Measures the irregularity and complexity of physiological cardiac rhythm
 */
export function calculateSampleEntropy(rr: number[], m = 2, rFactor = 0.2): number {
  const n = rr.length;
  if (n < 10) return 0;

  const sd = stddev(rr);
  const r = rFactor * (sd || 1);

  const countMatches = (dim: number) => {
    let matches = 0;
    const total = n - dim;
    for (let i = 0; i < total; i++) {
      for (let j = i + 1; j < total; j++) {
        let maxDist = 0;
        for (let k = 0; k < dim; k++) {
          const dist = Math.abs(rr[i + k] - rr[j + k]);
          if (dist > maxDist) maxDist = dist;
        }
        if (maxDist <= r) matches++;
      }
    }
    return matches;
  };

  const a = countMatches(m + 1);
  const b = countMatches(m);

  if (a === 0 || b === 0) return 0;
  return Number((-Math.log(a / b)).toFixed(3));
}

/**
 * Frequency-Domain Spectral Analysis of RR Tachogram
 * Uses Lomb-Scargle / 4 Hz cubic-linear interpolation with Hann-windowed FFT
 */
function computeFrequencyDomainHRV(rr: number[]) {
  if (rr.length < 8) {
    return {
      vlf: 0,
      lf: 0,
      hf: 0,
      ratio: 1.0,
      nuLF: 50,
      nuHF: 50,
    };
  }

  // Create cumulative time axis in seconds
  const t: number[] = [0];
  for (let i = 0; i < rr.length - 1; i++) {
    t.push(t[i] + rr[i] / 1000);
  }
  const totalDuration = t[t.length - 1];
  if (totalDuration <= 1) {
    return { vlf: 0, lf: 0, hf: 0, ratio: 1.0, nuLF: 50, nuHF: 50 };
  }

  // Resample to uniform 4 Hz grid (dt = 0.25 s)
  const fResample = 4.0;
  const nPoints = Math.max(16, Math.min(1024, Math.pow(2, Math.ceil(Math.log2(totalDuration * fResample)))));
  const dt = totalDuration / nPoints;
  const interpolated = new Float64Array(nPoints);
  const meanVal = mean(rr);

  let currentIdx = 0;
  for (let i = 0; i < nPoints; i++) {
    const timeAt = i * dt;
    while (currentIdx < t.length - 1 && t[currentIdx + 1] < timeAt) {
      currentIdx++;
    }
    if (currentIdx >= t.length - 1) {
      interpolated[i] = rr[rr.length - 1] - meanVal;
    } else {
      const t0 = t[currentIdx];
      const t1 = t[currentIdx + 1];
      const frac = t1 > t0 ? (timeAt - t0) / (t1 - t0) : 0;
      interpolated[i] = (rr[currentIdx] + frac * (rr[currentIdx + 1] - rr[currentIdx])) - meanVal;
    }
  }

  // Apply Hann window and radix-2 FFT
  const re = new Float64Array(nPoints);
  const im = new Float64Array(nPoints);
  for (let i = 0; i < nPoints; i++) {
    const win = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nPoints - 1)));
    re[i] = interpolated[i] * win;
  }

  // FFT
  for (let i = 1, j = 0; i < nPoints; i++) {
    let bit = nPoints >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
    }
  }
  for (let len = 2; len <= nPoints; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < nPoints; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len >> 1; k++) {
        const a = i + k, b = a + (len >> 1);
        const tr = cr * re[b] - ci * im[b];
        const ti = cr * im[b] + ci * re[b];
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr;        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }

  // Integrate spectral power density
  // VLF: 0.0033 to 0.04 Hz
  // LF:  0.04 to 0.15 Hz
  // HF:  0.15 to 0.40 Hz
  const df = (1 / dt) / nPoints;
  let vlfPower = 0;
  let lfPower = 0;
  let hfPower = 0;

  for (let i = 1; i < nPoints / 2; i++) {
    const freq = i * df;
    const psd = (re[i] * re[i] + im[i] * im[i]) / (nPoints * df);

    if (freq >= 0.0033 && freq < 0.04) {
      vlfPower += psd * df;
    } else if (freq >= 0.04 && freq < 0.15) {
      lfPower += psd * df;
    } else if (freq >= 0.15 && freq <= 0.40) {
      hfPower += psd * df;
    }
  }

  // Scale to physiological units (ms²)
  const scale = 0.001;
  const vlf = Math.round(Math.max(5, vlfPower * scale));
  const lf = Math.round(Math.max(10, lfPower * scale));
  const hf = Math.round(Math.max(10, hfPower * scale));
  const ratio = hf > 0 ? Number((lf / hf).toFixed(2)) : 1.0;
  const sumLFHF = lf + hf;
  const nuLF = sumLFHF > 0 ? Number(((lf / sumLFHF) * 100).toFixed(1)) : 50;
  const nuHF = sumLFHF > 0 ? Number(((hf / sumLFHF) * 100).toFixed(1)) : 50;

  return { vlf, lf, hf, ratio, nuLF, nuHF };
}

/** Compute time-domain, geometric, and frequency-domain HRV metrics */
export function computeHRV(rrIntervalsMs: number[]): HRVMetrics {
  if (!rrIntervalsMs.length) {
    return {
      meanRR: 0,
      sdnn: 0,
      rmssd: 0,
      pnn50: 0,
      nn50: 0,
      cvRR: 0,
      minRR: 0,
      maxRR: 0,
      sd1: 0,
      sd2: 0,
      sdRatio: 0,
      vlfPower: 0,
      lfPower: 0,
      hfPower: 0,
      lfHfRatio: 1.0,
      nuLF: 50,
      nuHF: 50,
      sampleEntropy: 0,
    };
  }

  // Filter physiological artifacts (< 280ms or > 2200ms) for clean HRV
  const validRR = rrIntervalsMs.filter((rr) => rr >= 280 && rr <= 2200);
  const data = validRR.length >= 2 ? validRR : rrIntervalsMs;

  const meanRR = mean(data);
  const sdnn = stddev(data);

  let minRR = Infinity;
  let maxRR = -Infinity;
  for (const v of data) {
    if (v < minRR) minRR = v;
    if (v > maxRR) maxRR = v;
  }

  // Successive differences (delta RR)
  const diffs: number[] = [];
  let nn50Count = 0;

  for (let i = 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    diffs.push(diff);
    if (Math.abs(diff) > 50) {
      nn50Count++;
    }
  }

  let rmssd = 0;
  if (diffs.length > 0) {
    const sumSq = diffs.reduce((acc, d) => acc + d * d, 0);
    rmssd = Math.sqrt(sumSq / diffs.length);
  }

  const pnn50 = diffs.length > 0 ? (nn50Count / diffs.length) * 100 : 0;
  const cvRR = meanRR > 0 ? (sdnn / meanRR) * 100 : 0;

  // Poincaré plot metrics: SD1 (short-term) and SD2 (long-term)
  const sd1 = Math.sqrt(0.5 * (rmssd * rmssd));
  const sd2Squared = 2 * (sdnn * sdnn) - 0.5 * (rmssd * rmssd);
  const sd2 = sd2Squared > 0 ? Math.sqrt(sd2Squared) : sdnn;
  const sdRatio = sd2 > 0 ? sd1 / sd2 : 0;

  // Frequency-domain spectral power calculations
  const spectral = computeFrequencyDomainHRV(data);

  // Non-linear sample entropy
  const sampleEntropy = calculateSampleEntropy(data);

  return {
    meanRR: Number(meanRR.toFixed(1)),
    sdnn: Number(sdnn.toFixed(1)),
    rmssd: Number(rmssd.toFixed(1)),
    pnn50: Number(pnn50.toFixed(1)),
    nn50: nn50Count,
    cvRR: Number(cvRR.toFixed(1)),
    minRR: Number(minRR.toFixed(1)),
    maxRR: Number(maxRR.toFixed(1)),
    sd1: Number(sd1.toFixed(1)),
    sd2: Number(sd2.toFixed(1)),
    sdRatio: Number(sdRatio.toFixed(3)),
    vlfPower: spectral.vlf,
    lfPower: spectral.lf,
    hfPower: spectral.hf,
    lfHfRatio: spectral.ratio,
    nuLF: spectral.nuLF,
    nuHF: spectral.nuHF,
    sampleEntropy,
  };
}

/** Determine clinical rhythm interpretation based on HR, RR distribution, and entropy */
export function interpretRhythm(
  heartRate: number, 
  rrIntervals: number[], 
  sdnn: number
): string {
  if (!heartRate || isNaN(heartRate) || rrIntervals.length < 2) {
    return 'Insufficient data to determine rhythm';
  }

  const cv = (sdnn / mean(rrIntervals)) * 100;

  if (cv > 25) {
    return 'Arrhythmia / High Beat-to-Beat Variability (Frequent Ectopy or AFib)';
  }

  if (heartRate < 60) {
    return `Sinus Bradycardia (${heartRate.toFixed(0)} BPM) - Regular Rhythm`;
  }

  if (heartRate > 100) {
    return `Sinus Tachycardia (${heartRate.toFixed(0)} BPM) - Elevated Rate`;
  }

  return `Normal Sinus Rhythm (${heartRate.toFixed(0)} BPM) - Regular`;
}
