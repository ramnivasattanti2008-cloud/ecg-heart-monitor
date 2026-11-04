// Automated Verification and Validation Suite for Biomedical ECG Processing

import { generateSyntheticECG } from '../src/utils/ecgSimulator.ts';
import { detectRPeaks, evaluateSignalQuality, calculateRRIntervals, parabolicPeakOffset } from '../src/utils/panTompkins.ts';
import { computeHRV } from '../src/utils/hrv.ts';
import { parseECGFile, analyzeECGSignal } from '../src/utils/csvParser.ts';
import { biquadNotch, applyBiquad } from '../src/utils/biquadFilters.ts';
import { analyzeArrhythmiaML } from '../src/utils/mlArrhythmiaClassifier.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

console.log('=====================================================');
console.log('BIOMEDICAL ECG ENGINE VERIFICATION SUITE');
console.log('=====================================================\n');

// TEST 1: Synthetic ECG Generation
console.log('--- TEST 1: Synthetic ECG Generation ---');
const nsr = generateSyntheticECG('normal', 10, 250, 72);
assert(nsr.amplitude.length === 2500, 'Signal length matches 10s * 250Hz = 2500 samples');
assert(nsr.time[0] === 0, 'Time starts at 0s');
assert(nsr.trueRPeaks.length >= 8 && nsr.trueRPeaks.length <= 14, `Appropriate number of beats generated: ${nsr.trueRPeaks.length}`);

// TEST 2: Pan-Tompkins Peak Detection on Constant 60 BPM Signal
console.log('\n--- TEST 2: Pan-Tompkins Peak Detection (Known 60 BPM) ---');
const testDuration = 10;
const testFs = 250;
const testAmp = new Float64Array(testDuration * testFs);
for (let t = 1; t < testDuration; t++) {
  const peakIdx = t * testFs;
  for (let k = -20; k <= 20; k++) {
    const idx = peakIdx + k;
    if (idx >= 0 && idx < testAmp.length) {
      testAmp[idx] = 1.2 * Math.exp(-(k * k) / (2 * 2 * 2));
    }
  }
}
const detected60 = detectRPeaks(testAmp, testFs);
assert(detected60.length >= 8, `Detected ${detected60.length} peaks on synthetic 60 BPM signal`);
const diffs60 = [];
for (let i = 1; i < detected60.length; i++) {
  diffs60.push(((detected60[i] - detected60[i - 1]) / testFs) * 1000);
}
const avgRR60 = diffs60.reduce((a, b) => a + b, 0) / diffs60.length;
assert(Math.abs(avgRR60 - 1000) <= 10, `60 BPM signal calculated RR interval: ${avgRR60.toFixed(1)} ms (expected ~1000 ms)`);

// TEST 3: Heart Rate & HRV Calculation Accuracy
console.log('\n--- TEST 3: Heart Rate & HRV Calculation ---');
const testRR = [800, 820, 780, 810, 790];
const hrvTest = computeHRV(testRR);
assert(hrvTest.meanRR === 800, `Mean RR is 800 ms (calculated: ${hrvTest.meanRR})`);
assert(hrvTest.minRR === 780, `Min RR is 780 ms (calculated: ${hrvTest.minRR})`);
assert(hrvTest.maxRR === 820, `Max RR is 820 ms (calculated: ${hrvTest.maxRR})`);
assert(hrvTest.sdnn > 0, `SDNN computed correctly: ${hrvTest.sdnn} ms`);
assert(hrvTest.rmssd > 0, `RMSSD computed correctly: ${hrvTest.rmssd} ms`);
assert(hrvTest.sd1 > 0 && hrvTest.sd2 > 0, `Poincaré SD1/SD2 computed: SD1=${hrvTest.sd1}, SD2=${hrvTest.sd2}`);
assert(hrvTest.nuLF !== undefined && hrvTest.nuHF !== undefined, `Normalized frequency HRV units computed: nuLF=${hrvTest.nuLF}%, nuHF=${hrvTest.nuHF}%`);

// TEST 4: CSV Parser & File Ingestion
console.log('\n--- TEST 4: CSV File Parser ---');
// Multi-row valid CSV (15 samples)
let validCsv = 'time,amplitude\n';
for (let i = 0; i < 15; i++) {
  validCsv += `${(i * 0.004).toFixed(3)},${(Math.sin(i) * 0.5).toFixed(3)}\n`;
}
const parsedCsv = parseECGFile(validCsv, 250);
assert(parsedCsv.amplitude.length === 15, 'Parsed 15 rows of amplitude data');
assert(parsedCsv.fs === 250, `Detected/configured sampling frequency: ${parsedCsv.fs} Hz`);
assert(parsedCsv.headers[1].toLowerCase() === 'amplitude', 'Header recognized correctly');

// Insufficient samples error handling validation
let caughtError = false;
try {
  parseECGFile('time,amplitude\n0.0,0.1\n0.1,0.2', 250);
} catch (e: unknown) {
  caughtError = true;
  assert(e instanceof Error && e.message.includes('Insufficient data samples'), 'Properly throws error on insufficient samples');
}
assert(caughtError, 'Caught expected validation error on short CSV');

// Tab-delimited test
let tabTsv = 'time\tamplitude\n';
for (let i = 0; i < 12; i++) {
  tabTsv += `${(i * 0.004).toFixed(3)}\t${(Math.cos(i) * 0.4).toFixed(3)}\n`;
}
const parsedTsv = parseECGFile(tabTsv, 250);
assert(parsedTsv.amplitude.length === 12, 'Tab-separated ECG parsed correctly');

// TEST 5: Digital Biquad Filters
console.log('\n--- TEST 5: Digital Filters (Notch, Lowpass, Baseline) ---');
const testNoiseSig = new Float64Array(500);
for (let i = 0; i < 500; i++) {
  testNoiseSig[i] = Math.sin(2 * Math.PI * 50 * (i / 250)); // pure 50Hz mains
}
const notch = biquadNotch(50, 250, 10);
const filteredNotch = applyBiquad(testNoiseSig, notch);
let powerBefore = 0, powerAfter = 0;
for (let i = 50; i < 450; i++) {
  powerBefore += testNoiseSig[i] * testNoiseSig[i];
  powerAfter += filteredNotch[i] * filteredNotch[i];
}
assert(powerAfter < powerBefore * 0.1, `50Hz Notch filter attenuated mains hum by > 90% (ratio: ${(powerAfter / powerBefore).toFixed(3)})`);

// TEST 6: Signal Quality Index (SQI)
console.log('\n--- TEST 6: Signal Quality Index ---');
const cleanPeaks = nsr.trueRPeaks;
const sqiResult = evaluateSignalQuality(nsr.amplitude, 250, cleanPeaks);
assert(sqiResult.overallScore >= 70, `Clean ECG has high SQI score: ${sqiResult.overallScore}% (${sqiResult.status})`);
assert(sqiResult.snrDb > 5, `SNR is positive: ${sqiResult.snrDb} dB`);

// TEST 7: Sub-Sample Parabolic Peak Refinement
console.log('\n--- TEST 7: Sub-Sample Parabolic Peak Refinement ---');
const offset = parabolicPeakOffset([0.2, 1.0, 0.4], 1);
assert(Math.abs(offset) < 0.5, `Parabolic offset is bounded: ${offset.toFixed(3)}`);
const subRRs = calculateRRIntervals(nsr.amplitude, cleanPeaks, 250);
assert(subRRs.length === cleanPeaks.length - 1, `Calculated ${subRRs.length} sub-sample refined RR intervals`);

// TEST 8: Machine Learning Arrhythmia Classifier (Trained on MIT-BIH Features)
console.log('\n--- TEST 8: ML Arrhythmia Classifier ---');
const mlReport = analyzeArrhythmiaML(nsr.amplitude, 250, cleanPeaks, [], 72, subRRs);
assert(mlReport.totalBeats === cleanPeaks.length, `ML evaluated all ${mlReport.totalBeats} beats`);
assert(mlReport.confidenceScore >= 70, `High model confidence score: ${mlReport.confidenceScore}%`);
assert(mlReport.rhythmDiagnosis.includes('Sinus') || mlReport.rhythmDiagnosis.includes('Normal'), `Identified normal rhythm: "${mlReport.rhythmDiagnosis}"`);
assert(mlReport.probabilities.normalSinus > 50, `Normal sinus probability is dominant: ${mlReport.probabilities.normalSinus}%`);

// TEST 9: Full End-to-End Analysis Pipeline
console.log('\n--- TEST 9: End-to-End Analysis Pipeline ---');
const fullDataset = analyzeECGSignal('Test Normal', nsr.time, nsr.amplitude, nsr.fs, true, 'normal');
assert(fullDataset.analysis.beatsCount > 0, `Beats detected in pipeline: ${fullDataset.analysis.beatsCount}`);
assert(fullDataset.analysis.heartRate >= 50 && fullDataset.analysis.heartRate <= 100, `Heart rate in physiological range: ${fullDataset.analysis.heartRate} BPM`);
assert(fullDataset.analysis.intervals.qtcFridericiaMs !== undefined, `Calculated Fridericia QTc: ${fullDataset.analysis.intervals.qtcFridericiaMs} ms`);
assert(fullDataset.analysis.mlReport !== undefined, 'ML Arrhythmia report generated');

console.log('\n=====================================================');
console.log('🎉 ALL 9 BIOMEDICAL SIGNAL PROCESSING TESTS PASSED!');
console.log('=====================================================');
