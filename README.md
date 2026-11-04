# CardioPulse BioMonitor &bull; ECG Heart Rate & Biomedical Signal Analysis System

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-purple.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-cyan.svg)](https://tailwindcss.com/)

A hospital-grade, client-side biomedical signal processing and telemetry application for electrocardiogram (ECG) monitoring, **Pan–Tompkins QRS complex detection**, dynamic clinical interval extraction (PR, QRS, QT, QTc), and comprehensive **Heart Rate Variability (HRV)** analysis in the browser.

Zero backend dependencies, zero installation required, and 100% privacy-first local processing.

---

## 📸 System Overview & Features

### 1. Live Telemetry & Hospital Oscilloscope
- **60 FPS Real-time Stream**: Dual-mode sweeping oscilloscope beam or scrolling telemetry strip.
- **Realistic Cardiac Waves**: Dynamic P-wave, QRS complex, and T-wave generation based on a Gaussian cardiac dipole model.
- **Interactive Multi-Rhythm Simulator**:
  - *Normal Sinus Rhythm (NSR)* (regular P-QRS-T)
  - *Sinus Bradycardia* (< 60 BPM)
  - *Sinus Tachycardia* (> 100 BPM)
  - *Premature Ventricular Contractions (PVC)* (ventricular ectopy with compensatory pause)
  - *Atrial Fibrillation (AFib)* (irregular RR intervals, chaotic fibrillatory f-waves, absent P-waves)
  - *High-Noise / Motion Artifact* (severe baseline drift + 50Hz mains + EMG)
- **Clinical Display Settings**:
  - Adjustable paper speed: `12.5 mm/s`, `25 mm/s` (standard), `50 mm/s`
  - Adjustable amplitude gain: `0.5x (5 mm/mV)`, `1.0x (10 mm/mV)`, `2.0x (20 mm/mV)`
  - Standard 1 mV calibration step pulse (10 mm high, 0.2 s wide)
  - Authentic bedside monitor heartbeat tone synthesis via Web Audio API (with mute toggle).

### 2. Pan–Tompkins QRS Detection Algorithm
Implements the clinical gold-standard Pan–Tompkins pipeline:
1. **Bandpass Filter (5 – 15 Hz)**: Second-order highpass and lowpass biquad filters to attenuate P/T waves, muscle noise, and powerline interference.
2. **Five-Point Derivative Operator**: Emphasizes steep QRS ventricular depolarization slopes:
   $$y[n] = \frac{1}{8T} (2x[n] + x[n-1] - x[n-3] - 2x[n-4])$$
3. **Pointwise Squaring**: Nonlinear rectifier $y[n] = x^2[n]$ amplifying large QRS complexes over low-amplitude background noise.
4. **Moving-Window Integration (~150 ms)**: Extracts the signal energy envelope.
5. **Adaptive Dual-Thresholding with Search-Back**: Continuous updates to signal peak estimate ($SPKI$) and noise estimate ($NPKI$). If a beat is overdue ($> 1.66 \times RR_{\text{mean}}$), a search-back identifies the highest subthreshold candidate.
6. **Fiducial Point Refinement**: Refines detection onto the baseline-subtracted signal within a symmetric search window to locate exact R-peak coordinates.

### 3. Heart Rate & Heart Rate Variability (HRV) Suite
- **BPM Calculations**: Instantaneous, rolling average, minimum, and maximum heart rate calculated directly from detected RR intervals.
- **Time-Domain Metrics**:
  - **Mean RR**: Average interval between successive normal beats (ms).
  - **SDNN**: Standard deviation of NN intervals — reflection of total cardiac autonomic reserve.
  - **RMSSD**: Root mean square of successive differences — primary marker of parasympathetic (vagal) activity.
  - **pNN50 & NN50**: Percentage and count of adjacent RR intervals differing by $> 50\text{ ms}$.
  - **CVRR**: Coefficient of variation ($SDNN / MeanRR \times 100$).
- **Geometric & Phase-Space Analysis**:
  - **Poincaré Plot** ($RR_{n+1}$ vs $RR_n$ phase-space scatter):
    - $SD1 = \sqrt{0.5 \times RMSSD^2}$ (short-term beat-to-beat parasympathetic variability)
    - $SD2 = \sqrt{2 \times SDNN^2 - 0.5 \times RMSSD^2}$ (continuous long-term autonomic tone)
    - $SD1 / SD2$ ratio
  - **RR Interval Tachogram**: Beat-by-beat progression chart.
  - **RR Distribution Histogram**: Frequency binning of beat timings.

### 4. Interactive Signal Processing & Filter Lab
- **Side-by-Side & Overlay Comparator**: View raw input vs. filtered trace in real time.
- **Digital Filter Switches**:
  - Baseline wander removal (moving average subtraction / 0.5 Hz highpass)
  - 50 Hz AC powerline notch filter (European / Asian grid)
  - 60 Hz AC powerline notch filter (North American grid)
  - 40 Hz lowpass muscle tremor filter (standard ECG monitor bandwidth)
- **Fast Fourier Transform (FFT)**:
  - Radix-2 Cooley-Tukey FFT with Hann windowing for Power Spectral Density (PSD) analysis from 0 to 60 Hz.
- **Signal Quality Index (SQI)**:
  - Estimated SNR in dB, baseline stability percentage, sensor saturation / clipping detection.

### 5. ECG File Ingestion & Built-In Datasets
- **Universal File Parser**: Drag-and-drop support for `.csv`, `.txt`, `.dat`, and `.tsv` recordings.
- **Smart Column Detection**: Automatic recognition of time/amplitude axes, header detection, and sampling frequency ($F_s$) estimation.
- **Interactive Column Mapper**: Select custom columns and override $F_s$ (Hz).
- **1-Click Clinical Presets**:
  - *PhysioNet MIT-BIH Arrhythmia Database*: Normal Sinus Rhythm, Sinus Tachycardia, PVC Arrhythmia, and High-Noise Recording.
  - *Synthetic Models*: Bradycardia, Tachycardia, PVC, Atrial Fibrillation.

### 6. Clinical Reports & Data Export
- **Printable Clinical Report Sheet**: Formatted hospital-style report with patient/session metadata, Lead II rhythm strip with 25 mm/s and 10 mm/mV grid markings, automated rhythm impression, and calculated metrics table.
- **Direct PDF Export**: Compatible with browser print dialog (`Ctrl+P` / `Cmd+P`).
- **CSV Beat Log Export**: Export beat-by-beat sample index, timestamp, RR interval, and instantaneous BPM.
- **Structured JSON Export**: Complete dataset and metric object for downstream biomedical research pipelines.

---

## 🛠️ Tech Stack & Architecture

- **Framework**: React 19 + TypeScript (Vite bundler)
- **Styling**: Tailwind CSS v4 with custom medical monitor theme & phosphor glow effects
- **Visuals**: High-performance HTML5 2D Canvas rendering (60 FPS zero-lag oscilloscope)
- **DSP Engine**: Custom TypeScript implementation of RBJ biquad IIR filters, Pan–Tompkins QRS detector, and Radix-2 FFT
- **Audio Engine**: Web Audio API sine oscillator with rapid decay envelope
- **Testing**: Automated verification suite with Node.js & tsx

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (tested on Node v20 and v24)
- npm or pnpm

### Installation

```bash
# Clone or navigate to the project directory
cd ecg-heart-monitor

# Install dependencies
npm install
```

### Running Locally

```bash
# Start Vite development server
npm run dev

# Open your browser at http://localhost:5173
```

### Running the Verification Suite

Run the biomedical algorithm verification suite:

```bash
npm test
```

This verifies:
1. Synthetic multi-rhythm ECG generation
2. Pan-Tompkins peak detection on known 60 BPM and 120 BPM signals
3. Heart rate and HRV metrics calculation accuracy
4. CSV / TSV file parser and error validation
5. Biquad digital filters (50 Hz notch, 40 Hz lowpass, baseline wander)
6. Signal Quality Index (SQI) evaluation
7. End-to-end telemetry pipeline

### Production Build

```bash
# Compile TypeScript and build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 📦 Project Structure

```
ecg-heart-monitor/
├── public/
│   └── samples/                   # Real PhysioNet MIT-BIH sample CSV files
│       ├── ecg_normal.csv
│       ├── ecg_tachycardia.csv
│       ├── ecg_pvc.csv
│       └── ecg_noisy.csv
├── src/
│   ├── components/
│   │   ├── Navbar.tsx             # Medical header with live telemetry & controls
│   │   ├── OverviewDashboard.tsx  # Master vital signs & active dataset overview
│   │   ├── LiveMonitor.tsx        # 60 FPS oscilloscope with medical grid & calibration
│   │   ├── UploadECG.tsx          # CSV drag-and-drop & preset selector
│   │   ├── SignalAnalysis.tsx     # Filter Lab, Raw vs Filtered, FFT spectrum
│   │   ├── HeartRateHRV.tsx       # Tachogram, Poincaré plot, RR histogram, HRV table
│   │   ├── Reports.tsx            # Printable report sheet, CSV and JSON exporter
│   │   └── AboutProject.tsx       # Algorithm theory, formulas, and attribution
│   ├── context/
│   │   └── ECGContext.tsx         # Global telemetry state and stream provider
│   ├── types/
│   │   └── ecg.ts                 # TypeScript interfaces for ECG, HRV, SQI
│   ├── utils/
│   │   ├── biquadFilters.ts       # Butterworth, notch, lowpass, highpass filters
│   │   ├── panTompkins.ts         # Pan-Tompkins QRS detector & wave fiducials
│   │   ├── hrv.ts                 # Time-domain, frequency, and Poincaré HRV engine
│   │   ├── ecgSimulator.ts        # Multi-rhythm Gaussian dipole ECG simulator
│   │   ├── csvParser.ts           # Universal CSV/TSV parser & decimation
│   │   ├── audioBeep.ts           # Web Audio API heart tone synthesizer
│   │   └── fft.ts                 # Radix-2 Cooley-Tukey FFT power spectrum
│   ├── App.tsx                    # Top-level application shell & tab routing
│   ├── index.css                  # Tailwind CSS v4 & ECG paper grid styles
│   └── main.tsx                   # React root mount
├── scripts/
│   └── verify-ecg.ts              # Automated biomedical test suite
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 📜 Attribution & License

This project was built with functional reference to the open-source [Biomedical Signal Toolkit](https://github.com/vberardocco/biomedical-signal-toolkit) by Vittorio Berardocco:
- Reference Application: https://vberardocco.github.io/biomedical-signal-toolkit/
- Reference GitHub: https://github.com/vberardocco/biomedical-signal-toolkit

Original work Copyright (c) 2024 Vittorio Berardocco under the [MIT License](LICENSE).
We gratefully acknowledge their reference implementation for browser-based biomedical signal processing.

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

## ⚠️ Medical Disclaimer

**CardioPulse BioMonitor is designed solely for educational, engineering, and scientific research simulation purposes.** It is **not** a certified medical device and has not received clearance or approval from the U.S. FDA, CE, or any other regulatory health authority. 

Waveforms, detected peaks, rhythm classifications, and calculated metrics should **never** be used for clinical diagnosis, patient monitoring, emergency triage, or treatment decisions. Always consult a licensed physician or cardiologist for clinical ECG interpretations.
