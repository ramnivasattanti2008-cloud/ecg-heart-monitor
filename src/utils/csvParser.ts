// CSV and Biomedical Data Parsing, Validation, and Decimation

import { detectRPeaks, extractFiducials, calculateIntervals, evaluateSignalQuality, calculateRRIntervals, computeAverageBeatTemplate } from './panTompkins';
import { applyECGFilters } from './biquadFilters';
import { computeHRV, interpretRhythm } from './hrv';
import { analyzeArrhythmiaML } from './mlArrhythmiaClassifier';
import type { ECGDataset, ECGAnalysisResult } from '../types/ecg';

export interface ParsedCSVData {
  time: number[];
  amplitude: number[];
  fs: number;
  derivedFs: boolean;
  headers: string[];
  columns: number[][];
  rawText: string;
}

/** Detect delimiter and split lines */
export function parseECGFile(
  text: string, 
  fallbackFs = 250, 
  selectedTimeCol = -1, 
  selectedAmpCol = -1
): ParsedCSVData {
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (!rawLines.length) {
    throw new Error('The file is empty. Please upload a valid CSV or TXT file with ECG data.');
  }

  // Detect delimiter: check commas, tabs, semicolons, whitespace
  const firstFew = rawLines.slice(0, 5).join('\n');
  let delimiter = ',';
  if ((firstFew.match(/\t/g) || []).length > (firstFew.match(/,/g) || []).length) {
    delimiter = '\t';
  } else if ((firstFew.match(/;/g) || []).length > (firstFew.match(/,/g) || []).length) {
    delimiter = ';';
  }

  const splitRow = (line: string) => {
    if (delimiter === '\t') return line.split('\t').map((s) => s.trim()).filter((s) => s.length);
    if (delimiter === ';') return line.split(';').map((s) => s.trim()).filter((s) => s.length);
    return line.split(/[\s,;\t]+/).map((s) => s.trim()).filter((s) => s.length);
  };

  let headers: string[] = [];
  let startIndex = 0;
  const firstCells = splitRow(rawLines[0]);

  // Check if first row is header
  const isHeader = firstCells.some((c) => isNaN(Number(c)));
  if (isHeader) {
    headers = firstCells;
    startIndex = 1;
  } else {
    headers = firstCells.map((_, i) => `Col ${i + 1}`);
  }

  const columns: number[][] = [];
  for (let i = startIndex; i < rawLines.length; i++) {
    const cells = splitRow(rawLines[i]);
    if (!cells.length) continue;
    for (let c = 0; c < cells.length; c++) {
      const val = Number(cells[c]);
      if (!isNaN(val)) {
        if (!columns[c]) columns[c] = [];
        columns[c].push(val);
      }
    }
  }

  if (!columns.length || !columns[0].length) {
    throw new Error('No valid numeric ECG samples found in the uploaded file.');
  }

  // Find amplitude and time columns if not manually specified
  let timeIdx = selectedTimeCol;
  let ampIdx = selectedAmpCol;

  if (timeIdx === -1 && ampIdx === -1) {
    if (isHeader) {
      const lowerHeaders = headers.map((h) => h.toLowerCase());
      const findCol = (keywords: string[]) => lowerHeaders.findIndex((h) => keywords.some((k) => h.includes(k)));

      const tIdx = findCol(['time', 'sec', 'second', 'ms', 'timestamp', 't']);
      const aIdx = findCol(['amp', 'val', 'ecg', 'signal', 'volt', 'mv', 'lead', 'mlii', 'v1', 'v5']);

      if (tIdx !== -1) timeIdx = tIdx;
      if (aIdx !== -1) ampIdx = aIdx;
      else if (timeIdx !== -1) ampIdx = timeIdx === 0 ? 1 : 0;
    }

    if (ampIdx === -1) {
      if (columns.length >= 2) {
        // Test if column 0 is strictly increasing (time)
        const c0 = columns[0];
        let isMonotonic = true;
        for (let i = 1; i < Math.min(c0.length, 50); i++) {
          if (c0[i] <= c0[i - 1]) {
            isMonotonic = false;
            break;
          }
        }
        if (isMonotonic) {
          timeIdx = 0;
          ampIdx = 1;
        } else {
          ampIdx = 0;
        }
      } else {
        ampIdx = 0;
      }
    }
  }

  if (ampIdx === -1 || !columns[ampIdx]) {
    ampIdx = 0;
  }

  const amplitude = columns[ampIdx];
  if (!amplitude || amplitude.length < 10) {
    throw new Error('Insufficient data samples. An ECG recording needs at least 10 samples.');
  }

  // Compute or verify sampling frequency
  let fs = fallbackFs;
  let derivedFs = false;
  let time: number[] = [];

  if (timeIdx !== -1 && columns[timeIdx] && columns[timeIdx].length === amplitude.length) {
    const rawTime = columns[timeIdx];
    const diffs: number[] = [];
    for (let i = 1; i < Math.min(rawTime.length, 500); i++) {
      const dt = rawTime[i] - rawTime[i - 1];
      if (dt > 0) diffs.push(dt);
    }
    if (diffs.length > 5) {
      diffs.sort((a, b) => a - b);
      const medianDt = diffs[Math.floor(diffs.length / 2)];
      if (medianDt > 0) {
        fs = Math.round(1 / medianDt);
        derivedFs = true;
      }
    }
    time = rawTime;
  }

  if (!time.length) {
    time = new Array<number>(amplitude.length);
    for (let i = 0; i < amplitude.length; i++) {
      time[i] = Number((i / fs).toFixed(5));
    }
  }

  return {
    time,
    amplitude,
    fs,
    derivedFs,
    headers,
    columns,
    rawText: text,
  };
}

/** Analyze parsed dataset and calculate all medical metrics */
export function analyzeECGSignal(
  name: string,
  time: number[],
  rawAmplitude: number[],
  fs: number,
  isSimulated = false,
  rhythm?: import('../types/ecg').RhythmType
): ECGDataset {
  // 1. Filter signal with standard ECG filter chain
  const filtered = applyECGFilters(rawAmplitude, fs, {
    removeBaseline: true,
    notch50: true,
    notch60: true,
    lowpass40: true,
  });
  const filteredAmplitude = Array.from(filtered);

  // 2. Detect R-peaks via Pan-Tompkins
  const rPeaks = detectRPeaks(filteredAmplitude, fs);

  // 3. Calculate high-accuracy sub-sample parabolic RR intervals in milliseconds
  const rrIntervals = calculateRRIntervals(filteredAmplitude, rPeaks, fs);

  // 4. Calculate Heart Rates
  let avgHR = 0;
  let minHR = 0;
  let maxHR = 0;
  let heartRate = 0;

  if (rrIntervals.length > 0) {
    const instantaneousBpm = rrIntervals.map((rr) => (rr > 0 ? 60000 / rr : 0)).filter((bpm) => bpm >= 30 && bpm <= 250);
    if (instantaneousBpm.length > 0) {
      avgHR = Math.round(instantaneousBpm.reduce((a, b) => a + b, 0) / instantaneousBpm.length);
      minHR = Math.round(Math.min(...instantaneousBpm));
      maxHR = Math.round(Math.max(...instantaneousBpm));
      heartRate = instantaneousBpm[instantaneousBpm.length - 1] || avgHR;
    }
  }

  // 5. Compute HRV Metrics (Time, Frequency, and Entropy)
  const hrv = computeHRV(rrIntervals);

  // 6. Extract P, Q, R, S, J, T fiducials
  const fiducials = extractFiducials(filteredAmplitude, rPeaks, fs);

  // 7. Calculate Clinical Intervals (PR, QRS, QT, QTc Bazett & Fridericia, ST deviation)
  const intervals = calculateIntervals(fiducials, hrv.meanRR);

  // 8. Evaluate Signal Quality Index
  const sqi = evaluateSignalQuality(rawAmplitude, fs, rPeaks);

  // 9. Trained MIT-BIH ML Arrhythmia Classifier Model
  const mlReport = analyzeArrhythmiaML(filteredAmplitude, fs, rPeaks, fiducials, avgHR || heartRate, rrIntervals);

  // 10. Rhythm interpretation
  const rhythmInterpretation = mlReport.rhythmDiagnosis || interpretRhythm(avgHR || heartRate, rrIntervals, hrv.sdnn);

  // 11. Average beat template (+/- 1 SD morphology envelope)
  const beatTemplate = computeAverageBeatTemplate(filteredAmplitude, rPeaks, fs);

  const durationSeconds = Number((rawAmplitude.length / fs).toFixed(2));

  const analysis: ECGAnalysisResult = {
    heartRate: Math.round(heartRate),
    minHR,
    maxHR,
    avgHR,
    beatsCount: rPeaks.length,
    durationSeconds,
    samplingRate: fs,
    rPeaks,
    rrIntervals,
    fiducials,
    hrv,
    sqi,
    intervals,
    rhythmInterpretation,
    mlReport,
    beatTemplate,
  };

  return {
    name,
    isSimulated,
    rhythm,
    samplingRate: fs,
    time,
    rawAmplitude,
    filteredAmplitude,
    analysis,
  };
}

/** Min/Max Decimation to preserve visual R-peaks while rendering thousands of points smoothly */
export function decimateSignal(
  time: number[], 
  amp: number[], 
  maxPoints = 2500
): { x: number; y: number }[] {
  const n = amp.length;
  if (n <= maxPoints) {
    const pts = new Array<{ x: number; y: number }>(n);
    for (let i = 0; i < n; i++) pts[i] = { x: time[i], y: amp[i] };
    return pts;
  }

  const bucketSize = Math.ceil(n / (maxPoints / 2));
  const pts: { x: number; y: number }[] = [];

  for (let i = 0; i < n; i += bucketSize) {
    const end = Math.min(n, i + bucketSize);
    let minIdx = i;
    let maxIdx = i;

    for (let j = i; j < end; j++) {
      if (amp[j] < amp[minIdx]) minIdx = j;
      if (amp[j] > amp[maxIdx]) maxIdx = j;
    }

    const first = minIdx < maxIdx ? minIdx : maxIdx;
    const second = minIdx < maxIdx ? maxIdx : minIdx;

    pts.push({ x: time[first], y: amp[first] });
    if (second !== first) {
      pts.push({ x: time[second], y: amp[second] });
    }
  }

  return pts;
}
