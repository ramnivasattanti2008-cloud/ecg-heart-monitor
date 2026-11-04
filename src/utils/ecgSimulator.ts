// Realistic Biomedical ECG Signal Simulator
// Multi-rhythm Gaussian cardiac dipole model with HRV, baseline wander, and sensor noise

import type { RhythmType } from '../types/ecg';

function gaussNoise(sd: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return sd * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

interface WaveformComponent {
  c: number; // center time offset relative to R-peak (seconds)
  a: number; // amplitude (mV)
  w: number; // width / standard deviation (seconds)
}

const NORMAL_WAVES: WaveformComponent[] = [
  { c: -0.18, a: 0.12, w: 0.024 },   // P wave (atrial depolarization)
  { c: -0.035, a: -0.15, w: 0.007 }, // Q wave (septal depolarization)
  { c: 0.00, a: 1.15, w: 0.012 },    // R wave (ventricular depolarization)
  { c: 0.035, a: -0.28, w: 0.008 },  // S wave (late ventricular depolarization)
  { c: 0.20, a: 0.32, w: 0.042 },    // T wave (ventricular repolarization)
];

const PVC_WAVES: WaveformComponent[] = [
  // No P wave!
  { c: -0.06, a: 0.25, w: 0.025 },   // notched onset
  { c: 0.00, a: -1.35, w: 0.035 },   // deep inverted or bizarre wide QRS
  { c: 0.08, a: 0.45, w: 0.030 },
  { c: 0.25, a: 0.55, w: 0.060 },    // discordant wide T-wave
];

/**
 * Generate a static ECG block for a given rhythm
 */
export function generateSyntheticECG(
  rhythm: RhythmType = 'normal',
  durationSec = 15,
  fs = 250,
  targetBpm = 75
): { time: number[]; amplitude: number[]; fs: number; trueRPeaks: number[] } {
  const n = Math.round(fs * durationSec);
  const time = new Array<number>(n);
  const amplitude = new Array<number>(n);
  const trueRPeaks: number[] = [];

  // Determine base heart rate & variability characteristics based on rhythm
  let baseBpm = targetBpm;
  let jitterSd = 0.025; // seconds
  let pvcProbability = 0;
  let baselineDriftAmp = 0.05;
  let noiseLevel = 0.015;
  let isAfib = false;

  switch (rhythm) {
    case 'bradycardia':
      baseBpm = 50;
      jitterSd = 0.035;
      break;
    case 'tachycardia':
      baseBpm = 130;
      jitterSd = 0.012;
      break;
    case 'pvc':
      baseBpm = 72;
      pvcProbability = 0.18; // ~1 in 5 beats is a PVC
      break;
    case 'afib':
      baseBpm = 95;
      isAfib = true;
      jitterSd = 0.14; // highly irregular RR intervals
      break;
    case 'noisy':
      baseBpm = 75;
      baselineDriftAmp = 0.35; // strong baseline wander
      noiseLevel = 0.12;      // strong EMG / mains noise
      break;
    case 'normal':
    default:
      baseBpm = 72;
      break;
  }

  // Pre-generate R-peak times
  interface BeatInfo {
    time: number;
    isPvc: boolean;
  }
  const beats: BeatInfo[] = [];
  let t = 0.4;

  while (t < durationSec - 0.2) {
    const isPvc = pvcProbability > 0 && beats.length > 1 && !beats[beats.length - 1].isPvc && Math.random() < pvcProbability;
    beats.push({ time: t, isPvc });

    let rrInterval: number;
    if (isPvc) {
      // Premature beat occurs early
      rrInterval = (60 / baseBpm) * 0.65;
    } else if (beats.length > 1 && beats[beats.length - 2].isPvc) {
      // Compensatory pause after PVC
      rrInterval = (60 / baseBpm) * 1.35;
    } else if (isAfib) {
      // Chaotic distribution
      rrInterval = Math.max(0.35, Math.min(1.4, (60 / baseBpm) + gaussNoise(jitterSd)));
    } else {
      rrInterval = Math.max(0.35, (60 / baseBpm) + gaussNoise(jitterSd));
    }

    t += rrInterval;
  }

  // Track true peak indices
  for (const b of beats) {
    const peakIdx = Math.round(b.time * fs);
    if (peakIdx >= 0 && peakIdx < n) {
      trueRPeaks.push(peakIdx);
    }
  }

  // Synthesize waveform
  for (let i = 0; i < n; i++) {
    const ti = i / fs;
    time[i] = Number(ti.toFixed(5));

    // 1. Respiration baseline wander (0.2 Hz)
    let v = baselineDriftAmp * Math.sin(2 * Math.PI * 0.2 * ti) + (baselineDriftAmp * 0.3) * Math.sin(2 * Math.PI * 0.08 * ti);

    // 2. Afib chaotic fibrillatory f-waves (4 - 7 Hz)
    if (isAfib) {
      v += 0.04 * Math.sin(2 * Math.PI * 5.2 * ti) + 0.03 * Math.sin(2 * Math.PI * 6.7 * ti + 1.2);
    }

    // 3. Cardiac wave summation
    for (const b of beats) {
      const dt = ti - b.time;
      if (Math.abs(dt) > 0.45) continue; // local influence only

      const waveSet = b.isPvc ? PVC_WAVES : NORMAL_WAVES;
      for (const w of waveSet) {
        // In Afib, P-wave is absent
        if (isAfib && w.c < -0.1) continue;

        const d = dt - w.c;
        v += w.a * Math.exp(-(d * d) / (2 * w.w * w.w));
      }
    }

    // 4. Powerline interference (50 Hz) in noisy mode
    if (rhythm === 'noisy') {
      v += 0.08 * Math.sin(2 * Math.PI * 50 * ti);
    }

    // 5. High-frequency EMG/sensor noise
    v += gaussNoise(noiseLevel);

    amplitude[i] = Number(v.toFixed(5));
  }

  return { time, amplitude, fs, trueRPeaks };
}

/**
 * Continuous real-time stream generator for live oscilloscope sweep
 */
export class LiveECGStreamer {
  private fs: number;
  private rhythm: RhythmType;
  private targetBpm: number;
  private currentTime: number = 0;
  private nextBeatTime: number = 0.3;
  private lastBeatTime: number = 0;
  private wasPvc: boolean = false;
  private sampleIndex: number = 0;

  constructor(fs = 250, rhythm: RhythmType = 'normal', targetBpm = 75) {
    this.fs = fs;
    this.rhythm = rhythm;
    this.targetBpm = targetBpm;
  }

  public setRhythm(rhythm: RhythmType) {
    this.rhythm = rhythm;
  }

  public setBpm(bpm: number) {
    this.targetBpm = Math.max(40, Math.min(180, bpm));
  }

  public nextSample(): { time: number; amplitude: number; isRPeak: boolean; sampleIndex: number } {
    const ti = this.currentTime;
    let isRPeak = false;

    // Check if next beat time reached
    let isPvc = false;
    if (ti >= this.nextBeatTime) {
      isRPeak = true;
      this.lastBeatTime = this.nextBeatTime;

      // Plan next beat
      let bpm = this.targetBpm;
      let jitter = 0.02;

      if (this.rhythm === 'bradycardia') {
        bpm = 48;
        jitter = 0.03;
      } else if (this.rhythm === 'tachycardia') {
        bpm = 135;
        jitter = 0.01;
      } else if (this.rhythm === 'pvc') {
        if (!this.wasPvc && Math.random() < 0.22) {
          isPvc = true;
        }
      } else if (this.rhythm === 'afib') {
        bpm = 95;
        jitter = 0.12;
      }

      let rr: number;
      if (isPvc) {
        rr = (60 / bpm) * 0.65;
        this.wasPvc = true;
      } else if (this.wasPvc) {
        rr = (60 / bpm) * 1.35;
        this.wasPvc = false;
      } else {
        rr = Math.max(0.32, (60 / bpm) + gaussNoise(jitter));
      }

      this.nextBeatTime = ti + rr;
    }

    // Synthesize current voltage
    let v = 0.04 * Math.sin(2 * Math.PI * 0.2 * ti); // subtle baseline

    if (this.rhythm === 'afib') {
      v += 0.035 * Math.sin(2 * Math.PI * 5.5 * ti);
    }

    const dt = ti - this.lastBeatTime;
    if (Math.abs(dt) < 0.45) {
      const waveSet = this.wasPvc ? PVC_WAVES : NORMAL_WAVES;
      for (const w of waveSet) {
        if (this.rhythm === 'afib' && w.c < -0.1) continue;
        const d = dt - w.c;
        v += w.a * Math.exp(-(d * d) / (2 * w.w * w.w));
      }
    }

    if (this.rhythm === 'noisy') {
      v += 0.25 * Math.sin(2 * Math.PI * 0.15 * ti); // wander
      v += 0.06 * Math.sin(2 * Math.PI * 50 * ti);   // mains
      v += gaussNoise(0.08);                         // EMG
    } else {
      v += gaussNoise(0.012);
    }

    this.currentTime += 1 / this.fs;
    const currentSampleIndex = this.sampleIndex++;

    return {
      time: ti,
      amplitude: v,
      isRPeak,
      sampleIndex: currentSampleIndex,
    };
  }
}
