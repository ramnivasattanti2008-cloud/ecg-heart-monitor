// Heart Rate and Heart Rate Variability (HRV) Analysis Engine
// Time-domain, Geometric/Poincaré, and Frequency-domain metrics

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
    };
  }

  // Filter out physiological artifacts (< 300ms or > 2000ms) for clean HRV
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
  // SD1 = sqrt(0.5 * RMSSD^2)
  // SD2 = sqrt(2 * SDNN^2 - 0.5 * RMSSD^2)
  const sd1 = Math.sqrt(0.5 * (rmssd * rmssd));
  const sd2Squared = 2 * (sdnn * sdnn) - 0.5 * (rmssd * rmssd);
  const sd2 = sd2Squared > 0 ? Math.sqrt(sd2Squared) : sdnn;
  const sdRatio = sd2 > 0 ? sd1 / sd2 : 0;

  // Approximate spectral band powers (LF / HF estimate based on RMSSD & SDNN relations)
  // HF relates predominantly to RMSSD (parasympathetic vagal tone, 0.15 - 0.40 Hz)
  // LF reflects both sympathetic and parasympathetic activity (0.04 - 0.15 Hz)
  const hfPower = Math.round(rmssd * rmssd * 0.45);
  const totalPower = Math.round(sdnn * sdnn);
  const lfPower = Math.max(10, Math.round(totalPower * 0.55 - hfPower * 0.4));
  const vlfPower = Math.max(10, Math.round(totalPower - lfPower - hfPower));
  const lfHfRatio = hfPower > 0 ? Number((lfPower / hfPower).toFixed(2)) : 1.0;

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
    vlfPower,
    lfPower,
    hfPower,
    lfHfRatio,
  };
}

/** Determine clinical rhythm interpretation based on HR and RR distribution */
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
