// Complete Biomedical Signal Toolkit Engine
// Implements ECG (Pan-Tompkins & HRV), EMG (RMS, MAV, ZCR), and EEG (FFT Band Power)

import { detectRPeaks, extractFiducials, calculateIntervals, evaluateSignalQuality } from './panTompkins';
import { computeHRV, interpretRhythm } from './hrv';
import { applyECGFilters } from './biquadFilters';
import type { ECGAnalysisResult } from '../types/ecg';

export type SignalCategory = 'ecg' | 'emg' | 'eeg';

export interface EMGMetrics {
  rms: number;
  mav: number;
  peakToPeak: number;
  zcr: number; // Hz
}

export interface EEGBandInfo {
  key: string;
  label: string;
  symbol: string;
  lo: number;
  hi: number;
  absolute: number;
  relative: number;
}

export interface EEGMetrics {
  bands: Record<string, EEGBandInfo>;
  totalBandPower: number;
  dominant: string;
  peakFreq: number;
  nyquist: number;
}

export interface AnalyzedSignalData {
  type: SignalCategory;
  fileName: string;
  time: number[];
  amplitude: number[];
  fs: number;
  derivedFs: boolean;
  min: number;
  max: number;
  duration: number;
  ecgMetrics?: ECGAnalysisResult;
  emgMetrics?: EMGMetrics;
  eegMetrics?: EEGMetrics;
}

export const EEG_BANDS = [
  { key: 'delta', label: 'Delta', symbol: 'δ', lo: 0.5, hi: 4 },
  { key: 'theta', label: 'Theta', symbol: 'θ', lo: 4, hi: 8 },
  { key: 'alpha', label: 'Alpha', symbol: 'α', lo: 8, hi: 13 },
  { key: 'beta', label: 'Beta', symbol: 'β', lo: 13, hi: 30 },
];

function mean(a: number[] | Float64Array): number {
  if (!a.length) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s / a.length;
}

function minMax(a: number[] | Float64Array): { min: number; max: number } {
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < a.length; i++) {
    if (a[i] < mn) mn = a[i];
    if (a[i] > mx) mx = a[i];
  }
  return { min: mn, max: mx };
}

function nextPow2(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(Math.max(2, n))));
}

/** In-place iterative radix-2 Cooley-Tukey FFT */
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
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
}

/** Compute EMG Metrics (RMS, MAV, Peak-to-Peak, Zero-Crossing Rate) */
export function computeEMG(signal: number[] | Float64Array, fs: number): EMGMetrics {
  const n = signal.length;
  let sumSq = 0, sumAbs = 0, zc = 0;
  const m = mean(signal);
  for (let i = 0; i < n; i++) {
    const v = signal[i] - m;
    sumSq += v * v;
    sumAbs += Math.abs(v);
    if (i > 0) {
      const prev = signal[i - 1] - m;
      if ((v >= 0 && prev < 0) || (v < 0 && prev >= 0)) zc++;
    }
  }
  const { min, max } = minMax(signal);
  return {
    rms: Math.sqrt(sumSq / n),
    mav: sumAbs / n,
    peakToPeak: max - min,
    zcr: (zc / n) * fs,
  };
}

/** Compute EEG Band Power via Hann windowed FFT */
export function computeEEG(signal: number[] | Float64Array, fs: number): EEGMetrics {
  const n0 = signal.length;
  const m = mean(signal);

  const N = nextPow2(n0);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  let winPower = 0;
  for (let i = 0; i < n0; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n0 - 1));
    re[i] = (signal[i] - m) * w;
    winPower += w * w;
  }
  fft(re, im);

  const half = N >> 1;
  const psd = new Float64Array(half + 1);
  const scale = 1 / (fs * (winPower || 1));
  for (let k = 0; k <= half; k++) {
    const p = (re[k] * re[k] + im[k] * im[k]) * scale;
    psd[k] = (k === 0 || k === half) ? p : 2 * p;
  }
  const df = fs / N;

  const bands: Record<string, EEGBandInfo> = {};
  let totalBandPower = 0;
  for (const b of EEG_BANDS) {
    let acc = 0;
    const kLo = Math.max(1, Math.ceil(b.lo / df));
    const kHi = Math.min(half, Math.floor(b.hi / df));
    for (let k = kLo; k <= kHi; k++) acc += psd[k] * df;
    bands[b.key] = { ...b, absolute: acc, relative: 0 };
    totalBandPower += acc;
  }
  for (const b of EEG_BANDS) {
    bands[b.key].relative = totalBandPower > 0 ? (bands[b.key].absolute / totalBandPower) * 100 : 0;
  }

  let dominant = EEG_BANDS[0].key;
  let peakBandPower = -1;
  for (const b of EEG_BANDS) {
    if (bands[b.key].absolute > peakBandPower) {
      peakBandPower = bands[b.key].absolute;
      dominant = b.key;
    }
  }

  let peakK = 1;
  const fNyq = fs / 2;
  for (let k = 1; k <= half; k++) {
    if (k * df > 45) break;
    if (psd[k] > psd[peakK]) peakK = k;
  }

  return {
    bands,
    totalBandPower,
    dominant,
    peakFreq: peakK * df,
    nyquist: fNyq,
  };
}

/** Compute ECG Metrics (Pan-Tompkins + HRV) */
export function computeECGToolkit(signal: number[] | Float64Array, fs: number): ECGAnalysisResult {
  const filtered = applyECGFilters(signal, fs, { removeBaseline: true, lowpass40: true });
  const filteredAmp = Array.from(filtered);
  const rPeaks = detectRPeaks(filteredAmp, fs);

  const rrIntervals: number[] = [];
  for (let i = 1; i < rPeaks.length; i++) {
    rrIntervals.push(((rPeaks[i] - rPeaks[i - 1]) / fs) * 1000);
  }

  const hrv = computeHRV(rrIntervals);
  const fiducials = extractFiducials(filteredAmp, rPeaks, fs);
  const intervals = calculateIntervals(fiducials, hrv.meanRR);
  const sqi = evaluateSignalQuality(signal, fs, rPeaks);

  let heartRate = 0;
  let minHR = 0;
  let maxHR = 0;
  let avgHR = 0;

  if (rrIntervals.length > 0) {
    const bpms = rrIntervals.map((rr) => (rr > 0 ? 60000 / rr : 0)).filter((b) => b >= 30 && b <= 240);
    if (bpms.length > 0) {
      avgHR = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
      minHR = Math.round(Math.min(...bpms));
      maxHR = Math.round(Math.max(...bpms));
      heartRate = bpms[bpms.length - 1] || avgHR;
    }
  }

  const rhythmInterpretation = interpretRhythm(avgHR || heartRate, rrIntervals, hrv.sdnn);

  return {
    heartRate: Math.round(heartRate),
    minHR,
    maxHR,
    avgHR,
    beatsCount: rPeaks.length,
    durationSeconds: Number((signal.length / fs).toFixed(2)),
    samplingRate: fs,
    rPeaks,
    rrIntervals,
    fiducials,
    hrv,
    sqi,
    intervals,
    rhythmInterpretation,
  };
}

/** Synthetic EMG generator (bursts of contraction over quiet baseline) */
export function generateSyntheticEMG(fs = 1000, seconds = 6): { time: number[]; amplitude: number[]; fs: number } {
  const n = Math.round(fs * seconds);
  const time = new Array<number>(n);
  const amplitude = new Array<number>(n);

  function boxMuller(sd: number) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  for (let i = 0; i < n; i++) {
    const ti = i / fs;
    const phase = ti % 1.5;
    const active = phase > 0.4 && phase < 1.1;
    const env = active ? 0.5 * (1 - Math.cos((2 * Math.PI * (phase - 0.4)) / 0.7)) : 0;
    const v = boxMuller(0.02) + env * boxMuller(1.0);
    time[i] = Number(ti.toFixed(5));
    amplitude[i] = Number(v.toFixed(5));
  }

  return { time, amplitude, fs };
}

/** Synthetic EEG generator (superposition of delta, theta, alpha, beta sinusoids + noise) */
export function generateSyntheticEEG(fs = 256, seconds = 12): { time: number[]; amplitude: number[]; fs: number } {
  const n = Math.round(fs * seconds);
  const time = new Array<number>(n);
  const amplitude = new Array<number>(n);

  function boxMuller(sd: number) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  const comps = [
    { f: 2.0, a: 0.20 },  // delta
    { f: 6.0, a: 0.15 },  // theta
    { f: 10.0, a: 0.55 }, // alpha (dominant)
    { f: 20.0, a: 0.10 }, // beta
  ].map((c) => ({ ...c, p: Math.random() * 2 * Math.PI }));

  for (let i = 0; i < n; i++) {
    const ti = i / fs;
    let v = 0;
    for (const c of comps) {
      v += c.a * Math.sin(2 * Math.PI * c.f * ti + c.p);
    }
    v += boxMuller(0.05);
    time[i] = Number(ti.toFixed(5));
    amplitude[i] = Number(v.toFixed(5));
  }

  return { time, amplitude, fs };
}

/** Master unified analyzer for any uploaded or generated signal */
export function analyzeAnySignal(
  type: SignalCategory,
  fileName: string,
  time: number[],
  amplitude: number[],
  fs: number,
  derivedFs = false
): AnalyzedSignalData {
  const { min, max } = minMax(amplitude);
  const duration = amplitude.length / fs;

  let ecgMetrics: ECGAnalysisResult | undefined;
  let emgMetrics: EMGMetrics | undefined;
  let eegMetrics: EEGMetrics | undefined;

  if (type === 'ecg') {
    ecgMetrics = computeECGToolkit(amplitude, fs);
  } else if (type === 'emg') {
    emgMetrics = computeEMG(amplitude, fs);
  } else if (type === 'eeg') {
    eegMetrics = computeEEG(amplitude, fs);
  }

  return {
    type,
    fileName,
    time,
    amplitude,
    fs,
    derivedFs,
    min,
    max,
    duration,
    ecgMetrics,
    emgMetrics,
    eegMetrics,
  };
}
