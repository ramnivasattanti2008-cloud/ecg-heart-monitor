// ECG Data and Signal Processing Type Definitions

export type RhythmType = 
  | 'normal' 
  | 'bradycardia' 
  | 'tachycardia' 
  | 'pvc' 
  | 'afib' 
  | 'noisy';

export interface WaveFiducials {
  rIndex: number;
  rTime: number;
  rAmp: number;
  pIndex?: number;
  pTime?: number;
  pAmp?: number;
  qIndex?: number;
  qTime?: number;
  qAmp?: number;
  sIndex?: number;
  sTime?: number;
  sAmp?: number;
  tIndex?: number;
  tTime?: number;
  tAmp?: number;
}

export interface HRVMetrics {
  meanRR: number;         // ms
  sdnn: number;           // ms (standard deviation of NN intervals)
  rmssd: number;          // ms (root mean square of successive differences)
  pnn50: number;          // % of successive differences > 50ms
  nn50: number;           // count of successive differences > 50ms
  cvRR: number;           // % coefficient of variation (SDNN / Mean RR)
  minRR: number;          // ms
  maxRR: number;          // ms
  sd1: number;            // ms (Poincare short term variability)
  sd2: number;            // ms (Poincare long term variability)
  sdRatio: number;        // SD1 / SD2
  // Frequency domain estimates
  vlfPower?: number;      // < 0.04 Hz
  lfPower?: number;       // 0.04 - 0.15 Hz
  hfPower?: number;       // 0.15 - 0.40 Hz
  lfHfRatio?: number;     // LF / HF
}

export interface SignalQualityIndex {
  overallScore: number;   // 0 - 100%
  status: 'excellent' | 'good' | 'marginal' | 'poor';
  snrDb: number;          // Signal-to-Noise Ratio (dB)
  baselineStability: number; // 0 - 100%
  clippingDetected: boolean;
  notes: string[];
}

export interface ECGAnalysisResult {
  heartRate: number;      // BPM
  minHR: number;          // BPM
  maxHR: number;          // BPM
  avgHR: number;          // BPM
  beatsCount: number;
  durationSeconds: number;
  samplingRate: number;
  rPeaks: number[];       // sample indices
  rrIntervals: number[];  // in milliseconds
  fiducials: WaveFiducials[];
  hrv: HRVMetrics;
  sqi: SignalQualityIndex;
  intervals: {
    prIntervalMs?: number;
    qrsDurationMs?: number;
    qtIntervalMs?: number;
    qtcMs?: number;       // Bazett corrected QT
  };
  rhythmInterpretation: string;
}

export interface FilterSettings {
  removeBaseline: boolean;
  notchFilter50Hz: boolean;
  notchFilter60Hz: boolean;
  lowpass40Hz: boolean;
  panTompkinsBandpass: boolean; // 5 - 15 Hz
}

export interface ECGDataset {
  name: string;
  isSimulated: boolean;
  rhythm?: RhythmType;
  samplingRate: number;
  time: number[];
  rawAmplitude: number[];
  filteredAmplitude: number[];
  analysis: ECGAnalysisResult;
}

export interface MonitorDisplaySettings {
  paperSpeed: 12.5 | 25 | 50; // mm/s
  voltageGain: 0.5 | 1 | 2;   // 5mm/mV, 10mm/mV, 20mm/mV
  gridTheme: 'green' | 'pink' | 'dark';
  showPeaks: boolean;
  showWaves: boolean;
  sweepMode: 'oscilloscope' | 'scroll';
  soundEnabled: boolean;
}
