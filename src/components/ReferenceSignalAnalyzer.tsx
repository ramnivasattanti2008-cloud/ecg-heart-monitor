import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  analyzeAnySignal, 
  generateSyntheticEMG, 
  generateSyntheticEEG, 
  EEG_BANDS 
} from '../utils/signalToolkitEngine';
import type { AnalyzedSignalData, SignalCategory } from '../utils/signalToolkitEngine';
import { generateSyntheticECG } from '../utils/ecgSimulator';
import { parseECGFile, decimateSignal } from '../utils/csvParser';
import { 
  FileSpreadsheet, 
  FileCode, 
  UploadCloud, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

function fmt(x: number | undefined | null, digits = 2): string {
  if (x === null || x === undefined || Number.isNaN(x) || !Number.isFinite(x)) return '—';
  const abs = Math.abs(x);
  if (abs !== 0 && (abs < 1e-3 || abs >= 1e6)) return x.toExponential(2);
  return x.toFixed(digits);
}

export const ReferenceSignalAnalyzer: React.FC = () => {
  const [signalType, setSignalType] = useState<SignalCategory>('ecg');
  const [samplingRate, setSamplingRate] = useState<number>(250);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const signalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bandCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Current Analyzed Signal
  const [dataset, setDataset] = useState<AnalyzedSignalData>(() => {
    const synth = generateSyntheticECG('normal', 12, 250, 72);
    return analyzeAnySignal('ecg', 'synthetic_ecg.csv', synth.time, synth.amplitude, 250, false);
  });

  // Load a synthetic sample
  const handleLoadSample = useCallback((type: SignalCategory) => {
    setSignalType(type);
    setStatusMsg(null);

    if (type === 'ecg') {
      setSamplingRate(250);
      const synth = generateSyntheticECG('normal', 12, 250, 72);
      const res = analyzeAnySignal('ecg', 'synthetic_ecg.csv', synth.time, synth.amplitude, 250, false);
      setDataset(res);
      setStatusMsg({ text: 'Loaded synthetic ECG sample (250 Hz, 12 s, 72 BPM)', isError: false });
    } else if (type === 'emg') {
      setSamplingRate(1000);
      const synth = generateSyntheticEMG(1000, 6);
      const res = analyzeAnySignal('emg', 'synthetic_emg.csv', synth.time, synth.amplitude, 1000, false);
      setDataset(res);
      setStatusMsg({ text: 'Loaded synthetic EMG sample (1,000 Hz, 6 s burst contractions)', isError: false });
    } else if (type === 'eeg') {
      setSamplingRate(256);
      const synth = generateSyntheticEEG(256, 12);
      const res = analyzeAnySignal('eeg', 'synthetic_eeg.csv', synth.time, synth.amplitude, 256, false);
      setDataset(res);
      setStatusMsg({ text: 'Loaded synthetic EEG sample (256 Hz, 12 s, Alpha-dominant)', isError: false });
    }
  }, []);

  // Load MIT-BIH preset file
  const handleLoadPresetFile = async (filename: string, name: string) => {
    setStatusMsg(null);
    try {
      const response = await fetch(`./samples/${filename}`);
      if (!response.ok) throw new Error(`Could not load ${filename}`);
      const text = await response.text();
      const parsed = parseECGFile(text, 360);
      setSignalType('ecg');
      setSamplingRate(parsed.fs);
      const res = analyzeAnySignal('ecg', name, parsed.time, parsed.amplitude, parsed.fs, parsed.derivedFs);
      setDataset(res);
      setStatusMsg({ text: `Successfully loaded ${name} (${parsed.amplitude.length.toLocaleString()} samples)`, isError: false });
    } catch (err) {
      setStatusMsg({ text: `Failed to load ${filename}: ${err instanceof Error ? err.message : String(err)}`, isError: true });
    }
  };

  // Process uploaded CSV file
  const handleProcessText = (text: string, filename: string) => {
    setStatusMsg(null);
    try {
      const parsed = parseECGFile(text, samplingRate);
      if (parsed.derivedFs) {
        setSamplingRate(parsed.fs);
      }
      const res = analyzeAnySignal(signalType, filename, parsed.time, parsed.amplitude, parsed.fs, parsed.derivedFs);
      setDataset(res);
      setStatusMsg({ 
        text: `Loaded ${filename}: ${parsed.amplitude.length.toLocaleString()} samples at ${parsed.fs} Hz${parsed.derivedFs ? ' (auto-detected time base)' : ''}.`, 
        isError: false 
      });
    } catch (err) {
      setStatusMsg({ 
        text: err instanceof Error ? err.message : 'Error parsing uploaded file.', 
        isError: true 
      });
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      handleProcessText(text, file.name);
    };
    reader.onerror = () => setStatusMsg({ text: 'Failed to read file from disk.', isError: true });
    reader.readAsText(file);
  };

  // Drag and Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      handleProcessText(text, file.name);
    };
    reader.readAsText(file);
  };

  // Render Time-domain Waveform on Canvas with decimation & R-peaks
  useEffect(() => {
    const canvas = signalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const marginL = 55;
    const marginB = 35;
    const marginT = 15;
    const marginR = 15;
    const plotW = width - marginL - marginR;
    const plotH = height - marginB - marginT;

    const minVal = dataset.min;
    const maxVal = dataset.max;
    const rangeY = (maxVal - minVal) || 1;

    // Grid lines
    ctx.strokeStyle = '#eeece6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const ySteps = 5;
    ctx.fillStyle = '#8c8c92';
    ctx.font = '10px ui-monospace, monospace';

    for (let i = 0; i <= ySteps; i++) {
      const y = marginT + (i / ySteps) * plotH;
      const v = maxVal - (i / ySteps) * rangeY;
      ctx.moveTo(marginL, y);
      ctx.lineTo(width - marginR, y);
      ctx.fillText(v.toFixed(2), 10, y + 3);
    }

    const duration = dataset.duration || 1;
    const xSteps = 6;
    for (let i = 0; i <= xSteps; i++) {
      const x = marginL + (i / xSteps) * plotW;
      const t = (i / xSteps) * duration;
      ctx.moveTo(x, marginT);
      ctx.lineTo(x, height - marginB);
      ctx.fillText(`${t.toFixed(1)}s`, x - 10, height - 12);
    }
    ctx.stroke();

    // Axis Border
    ctx.strokeStyle = '#e4e2db';
    ctx.strokeRect(marginL, marginT, plotW, plotH);

    // Decimated line plot
    const pts = decimateSignal(dataset.time, dataset.amplitude, 2500);
    if (pts.length > 1) {
      ctx.strokeStyle = '#15161b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();

      for (let i = 0; i < pts.length; i++) {
        const x = marginL + (pts[i].x / duration) * plotW;
        const y = marginT + (1 - (pts[i].y - minVal) / rangeY) * plotH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // For ECG, overlay detected R-peaks in cobalt accent
      if (dataset.type === 'ecg' && dataset.ecgMetrics && dataset.ecgMetrics.rPeaks.length > 0) {
        ctx.fillStyle = '#1d40d0';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;

        for (const idx of dataset.ecgMetrics.rPeaks) {
          const ptTime = dataset.time[idx];
          const ptAmp = dataset.amplitude[idx];
          if (ptTime !== undefined && ptAmp !== undefined) {
            const px = marginL + (ptTime / duration) * plotW;
            const py = marginT + (1 - (ptAmp - minVal) / rangeY) * plotH;

            ctx.beginPath();
            ctx.arc(px, py, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }
      }
    }
  }, [dataset]);

  // Render EEG Band Power Bar Chart
  useEffect(() => {
    if (dataset.type !== 'eeg' || !dataset.eegMetrics) return;

    const canvas = bandCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const bands = dataset.eegMetrics.bands;
    const bandKeys = EEG_BANDS;
    const marginL = 80;
    const marginB = 30;
    const marginT = 20;
    const plotW = width - marginL - 30;
    const plotH = height - marginB - marginT;

    const rowH = plotH / bandKeys.length;
    let maxPct = 0;
    for (const b of bandKeys) {
      if (bands[b.key]?.relative > maxPct) maxPct = bands[b.key].relative;
    }
    const maxBar = Math.max(50, Math.ceil(maxPct / 10) * 10);

    ctx.font = '11px ui-monospace, monospace';

    for (let i = 0; i < bandKeys.length; i++) {
      const b = bandKeys[i];
      const data = bands[b.key];
      const y = marginT + i * rowH;
      const barW = (data.relative / maxBar) * plotW;
      const isDominant = dataset.eegMetrics.dominant === b.key;

      // Label
      ctx.fillStyle = isDominant ? '#1d40d0' : '#15161b';
      ctx.fillText(`${b.symbol} ${b.label} (${b.lo}-${b.hi} Hz)`, 10, y + rowH / 2 + 4);

      // Bar Background
      ctx.fillStyle = '#f4f3ef';
      ctx.fillRect(marginL, y + 6, plotW, rowH - 12);

      // Bar
      ctx.fillStyle = isDominant ? '#1d40d0' : '#56565c';
      ctx.fillRect(marginL, y + 6, barW, rowH - 12);

      // Percentage label
      ctx.fillStyle = isDominant ? '#1d40d0' : '#15161b';
      ctx.fillText(`${data.relative.toFixed(1)}%`, marginL + barW + 8, y + rowH / 2 + 4);
    }
  }, [dataset]);

  // Download CSV
  const handleDownloadCSV = () => {
    let csv = `Biomedical Signal Analyzer — Results\n`;
    csv += `Generated,${new Date().toISOString()}\n`;
    csv += `File,${dataset.fileName}\n`;
    csv += `Signal type,${dataset.type.toUpperCase()}\n`;
    csv += `Samples,${dataset.amplitude.length}\n`;
    csv += `Duration (s),${fmt(dataset.duration, 4)}\n`;
    csv += `Sampling rate (Hz),${fmt(dataset.fs, 4)}\n`;
    csv += `Amplitude min,${fmt(dataset.min, 6)}\nAmplitude max,${fmt(dataset.max, 6)}\n\n`;

    csv += `Metric,Value,Unit\n`;
    if (dataset.type === 'ecg' && dataset.ecgMetrics) {
      const m = dataset.ecgMetrics;
      csv += `Heart Rate,${fmt(m.heartRate, 2)},bpm\n`;
      csv += `Beats Detected,${m.beatsCount},count\n`;
      csv += `Mean RR,${fmt(m.hrv.meanRR, 2)},ms\n`;
      csv += `SDNN,${fmt(m.hrv.sdnn, 2)},ms\n`;
      csv += `RMSSD,${fmt(m.hrv.rmssd, 2)},ms\n`;
      csv += `pNN50,${fmt(m.hrv.pnn50, 2)},%\n`;
      csv += `Rhythm Interpretation,"${m.rhythmInterpretation}",\n`;
    } else if (dataset.type === 'emg' && dataset.emgMetrics) {
      const m = dataset.emgMetrics;
      csv += `RMS,${fmt(m.rms, 6)},a.u.\n`;
      csv += `MAV,${fmt(m.mav, 6)},a.u.\n`;
      csv += `Peak-to-Peak,${fmt(m.peakToPeak, 6)},a.u.\n`;
      csv += `Zero-Crossing Rate,${fmt(m.zcr, 3)},Hz\n`;
    } else if (dataset.type === 'eeg' && dataset.eegMetrics) {
      const m = dataset.eegMetrics;
      for (const b of EEG_BANDS) {
        csv += `${b.label} relative power,${fmt(m.bands[b.key].relative, 2)},%\n`;
        csv += `${b.label} absolute power,${fmt(m.bands[b.key].absolute, 6)},a.u.\n`;
      }
      csv += `Peak Frequency,${fmt(m.peakFreq, 3)},Hz\n`;
      csv += `Dominant Band,${m.dominant},\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `results_${dataset.fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download JSON
  const handleDownloadJSON = () => {
    const obj = {
      meta: {
        app: 'Biomedical Signal Analyzer',
        generated: new Date().toISOString(),
        file: dataset.fileName,
        signalType: dataset.type,
        samples: dataset.amplitude.length,
        durationSeconds: dataset.duration,
        samplingRateHz: dataset.fs,
        derivedFs: dataset.derivedFs,
        range: { min: dataset.min, max: dataset.max },
      },
      metrics: dataset.type === 'ecg' ? dataset.ecgMetrics : dataset.type === 'emg' ? dataset.emgMetrics : dataset.eegMetrics,
    };

    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `results_${dataset.fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-7 text-[#15161b] font-sans">
      
      {/* Intro Hero Section (Exact reference styling) */}
      <section className="pt-4 pb-2 max-w-2xl">
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#15161b] leading-tight">
          Analyze biomedical signals in seconds
        </h2>
        <p className="text-base text-[#56565c] mt-3 leading-relaxed">
          Upload a CSV recording of an <strong>ECG</strong>, <strong>EMG</strong> or <strong>EEG</strong> signal and the analyzer automatically computes the relevant metrics and renders an interactive plot — entirely in your browser. No data ever leaves your device.
        </p>
      </section>

      {/* STEP 01: Configure & Load Signal Card */}
      <section className="bg-white border border-[#e4e2db] rounded-[2px] p-7 shadow-sm space-y-6">
        <h3 className="text-lg font-bold text-[#15161b] flex items-center">
          <span className="font-mono text-xs font-bold tracking-widest text-[#1d40d0] mr-3">01</span>
          <span>Configure &amp; load your signal</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Signal Type Segmented Control */}
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-[#8c8c92] mb-2 font-semibold">
              Signal type
            </label>
            <div className="inline-flex border border-[#15161b] rounded-[2px] overflow-hidden">
              {(['ecg', 'emg', 'eeg'] as SignalCategory[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleLoadSample(t)}
                  className={`px-5 py-2 font-mono text-xs font-bold tracking-wider uppercase transition-colors border-r last:border-r-0 border-[#e4e2db] ${
                    signalType === t 
                      ? 'bg-[#15161b] text-white' 
                      : 'bg-white text-[#56565c] hover:bg-[#f4f3ef]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#8c8c92] mt-2 font-mono">
              Determines which metrics are computed.
            </p>
          </div>

          {/* Sampling Rate Input */}
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-[#8c8c92] mb-2 font-semibold">
              Sampling rate (Hz)
            </label>
            <input
              type="number"
              min="1"
              max="100000"
              value={samplingRate}
              onChange={(e) => setSamplingRate(Number(e.target.value))}
              className="w-full bg-[#f4f3ef] border border-[#e4e2db] rounded-[2px] px-3.5 py-2 font-mono text-sm text-[#15161b] focus:outline-none focus:border-[#1d40d0]"
            />
            <p className="text-xs text-[#8c8c92] mt-2 font-mono">
              Used when the CSV has no time column. Auto-detected from a time column when present.
            </p>
          </div>
        </div>

        {/* Drag & Drop Upload Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-[2px] p-8 text-center cursor-pointer transition-colors ${
            dragActive 
              ? 'border-[#1d40d0] bg-[#1d40d0]/5' 
              : 'border-[#e4e2db] hover:border-[#8c8c92] bg-[#faf9f6]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,text/csv"
            onChange={handleFileInput}
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center space-y-2">
            <UploadCloud className="w-8 h-8 text-[#56565c]" />
            <p className="text-sm font-medium text-[#15161b]">
              <strong>Drag &amp; drop</strong> a CSV file here
            </p>
            <p className="text-xs text-[#56565c]">
              or <span className="text-[#1d40d0] font-semibold underline">browse your files</span>
            </p>
            <p className="text-[11px] font-mono text-[#8c8c92] pt-1">
              Accepted: <code>.csv</code> &bull; one or two columns (time, amplitude)
            </p>
          </div>
        </div>

        {/* Synthetic Samples & Presets Row */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono border-t border-[#eeece6]">
          <span className="text-[#8c8c92]">No data handy? Generate a synthetic sample:</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleLoadSample('ecg')}
              className={`px-3 py-1 border rounded-[2px] font-semibold transition-colors ${
                signalType === 'ecg' ? 'bg-[#15161b] text-white border-[#15161b]' : 'border-[#e4e2db] bg-[#f4f3ef] text-[#15161b] hover:border-[#15161b]'
              }`}
            >
              ECG
            </button>
            <button
              onClick={() => handleLoadSample('emg')}
              className={`px-3 py-1 border rounded-[2px] font-semibold transition-colors ${
                signalType === 'emg' ? 'bg-[#15161b] text-white border-[#15161b]' : 'border-[#e4e2db] bg-[#f4f3ef] text-[#15161b] hover:border-[#15161b]'
              }`}
            >
              EMG
            </button>
            <button
              onClick={() => handleLoadSample('eeg')}
              className={`px-3 py-1 border rounded-[2px] font-semibold transition-colors ${
                signalType === 'eeg' ? 'bg-[#15161b] text-white border-[#15161b]' : 'border-[#e4e2db] bg-[#f4f3ef] text-[#15161b] hover:border-[#15161b]'
              }`}
            >
              EEG
            </button>
            <button
              onClick={() => handleLoadPresetFile('ecg_normal.csv', 'MIT-BIH Normal Sinus')}
              className="px-3 py-1 border border-[#e4e2db] bg-[#f4f3ef] text-[#15161b] hover:border-[#1d40d0] rounded-[2px]"
              title="Load PhysioNet MIT-BIH Arrhythmia Recording"
            >
              MIT-BIH Normal
            </button>
            <button
              onClick={() => handleLoadPresetFile('ecg_tachycardia.csv', 'MIT-BIH Tachycardia')}
              className="px-3 py-1 border border-[#e4e2db] bg-[#f4f3ef] text-[#15161b] hover:border-[#1d40d0] rounded-[2px]"
            >
              Tachycardia
            </button>
            <button
              onClick={() => handleLoadPresetFile('ecg_pvc.csv', 'MIT-BIH PVC Arrhythmia')}
              className="px-3 py-1 border border-[#e4e2db] bg-[#f4f3ef] text-[#15161b] hover:border-[#1d40d0] rounded-[2px]"
            >
              PVC
            </button>
            <button
              onClick={() => handleLoadPresetFile('ecg_noisy.csv', 'MIT-BIH Noisy Recording')}
              className="px-3 py-1 border border-[#e4e2db] bg-[#f4f3ef] text-[#15161b] hover:border-[#1d40d0] rounded-[2px]"
            >
              Noisy
            </button>
          </div>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div className={`p-3 rounded-[2px] font-mono text-xs flex items-center gap-2 ${
            statusMsg.isError 
              ? 'bg-rose-50 text-rose-800 border border-rose-200' 
              : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
          }`}>
            {statusMsg.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{statusMsg.text}</span>
          </div>
        )}
      </section>

      {/* STEP 02: Results Card */}
      <section className="bg-white border border-[#e4e2db] rounded-[2px] p-7 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#eeece6] pb-5 gap-4">
          <h3 className="text-lg font-bold text-[#15161b] flex items-center">
            <span className="font-mono text-xs font-bold tracking-widest text-[#1d40d0] mr-3">02</span>
            <span>Results</span>
          </h3>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCSV}
              className="px-4 py-2 bg-[#15161b] hover:bg-[#1d40d0] text-white font-mono text-xs font-semibold rounded-[2px] transition-colors flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Download CSV</span>
            </button>
            <button
              onClick={handleDownloadJSON}
              className="px-4 py-2 border border-[#15161b] text-[#15161b] hover:bg-[#15161b] hover:text-white font-mono text-xs font-semibold rounded-[2px] transition-colors flex items-center gap-1.5"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Download JSON</span>
            </button>
          </div>
        </div>

        {/* Technical Spec-Sheet Summary Bar */}
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-mono text-xs">
          <div className="bg-[#f4f3ef] border border-[#e4e2db] p-3 rounded-[2px]">
            <dt className="text-[10px] uppercase text-[#8c8c92] tracking-wider">File</dt>
            <dd className="font-bold text-[#15161b] mt-1 truncate" title={dataset.fileName}>
              {dataset.fileName}
            </dd>
          </div>
          <div className="bg-[#f4f3ef] border border-[#e4e2db] p-3 rounded-[2px]">
            <dt className="text-[10px] uppercase text-[#8c8c92] tracking-wider">Signal type</dt>
            <dd className="font-bold text-[#15161b] mt-1 uppercase">{dataset.type}</dd>
          </div>
          <div className="bg-[#f4f3ef] border border-[#e4e2db] p-3 rounded-[2px]">
            <dt className="text-[10px] uppercase text-[#8c8c92] tracking-wider">Samples</dt>
            <dd className="font-bold text-[#15161b] mt-1">{dataset.amplitude.length.toLocaleString()}</dd>
          </div>
          <div className="bg-[#f4f3ef] border border-[#e4e2db] p-3 rounded-[2px]">
            <dt className="text-[10px] uppercase text-[#8c8c92] tracking-wider">Duration</dt>
            <dd className="font-bold text-[#15161b] mt-1">{fmt(dataset.duration, 2)} s</dd>
          </div>
          <div className="bg-[#f4f3ef] border border-[#e4e2db] p-3 rounded-[2px]">
            <dt className="text-[10px] uppercase text-[#8c8c92] tracking-wider">Sampling rate</dt>
            <dd className="font-bold text-[#15161b] mt-1">{fmt(dataset.fs, 1)} Hz{dataset.derivedFs ? ' (auto)' : ''}</dd>
          </div>
          <div className="bg-[#f4f3ef] border border-[#e4e2db] p-3 rounded-[2px]">
            <dt className="text-[10px] uppercase text-[#8c8c92] tracking-wider">Amplitude range</dt>
            <dd className="font-bold text-[#15161b] mt-1">{fmt(dataset.min, 2)} … {fmt(dataset.max, 2)}</dd>
          </div>
        </dl>

        {/* Metric Cards Grid (Swiss Hairline Architecture) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {dataset.type === 'ecg' && dataset.ecgMetrics && (
            <>
              <div className="bg-[#f4f3ef] border border-[#e4e2db] rounded-[2px] p-5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#8c8c92] block">Heart Rate</span>
                <div className="font-mono text-3xl font-bold text-[#1d40d0] mt-2">
                  {fmt(dataset.ecgMetrics.heartRate, 1)} <span className="text-xs font-normal text-[#8c8c92]">bpm</span>
                </div>
                <div className="text-xs text-[#8c8c92] mt-1 font-mono">
                  {dataset.ecgMetrics.beatsCount} beats detected
                </div>
              </div>

              <div className="bg-[#f4f3ef] border border-[#e4e2db] rounded-[2px] p-5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#8c8c92] block">Beats Detected</span>
                <div className="font-mono text-3xl font-bold text-[#15161b] mt-2">
                  {dataset.ecgMetrics.beatsCount}
                </div>
                <div className="text-xs text-[#8c8c92] mt-1 font-mono">R-peaks</div>
              </div>

              <div className="bg-[#f4f3ef] border border-[#e4e2db] rounded-[2px] p-5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#8c8c92] block">Mean RR</span>
                <div className="font-mono text-3xl font-bold text-[#15161b] mt-2">
                  {fmt(dataset.ecgMetrics.hrv.meanRR, 1)} <span className="text-xs font-normal text-[#8c8c92]">ms</span>
                </div>
                <div className="text-xs text-[#8c8c92] mt-1 font-mono">average inter-beat interval</div>
              </div>

              <div className="bg-[#f4f3ef] border border-[#e4e2db] rounded-[2px] p-5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#8c8c92] block">SDNN</span>
                <div className="font-mono text-3xl font-bold text-[#15161b] mt-2">
                  {fmt(dataset.ecgMetrics.hrv.sdnn, 1)} <span className="text-xs font-normal text-[#8c8c92]">ms</span>
                </div>
                <div className="text-xs text-[#8c8c92] mt-1 font-mono">overall HRV</div>
              </div>

              <div className="bg-[#f4f3ef] border border-[#e4e2db] rounded-[2px] p-5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#8c8c92] block">RMSSD</span>
                <div className="font-mono text-3xl font-bold text-[#15161b] mt-2">
                  {fmt(dataset.ecgMetrics.hrv.rmssd, 1)} <span className="text-xs font-normal text-[#8c8c92]">ms</span>
                </div>
                <div className="text-xs text-[#8c8c92] mt-1 font-mono">short-term HRV</div>
              </div>
            </>
          )}

          {dataset.type === 'emg' && dataset.emgMetrics && (
            <>
              <div className="bg-[#f4f3ef] border border-[#e4e2db] rounded-[2px] p-5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#8c8c92] block">RMS</span>
                <div className="font-mono text-2xl font-bold text-[#15161b] mt-2">
                  {fmt(dataset.emgMetrics.rms, 4)} <span className="text-xs font-normal text-[#8c8c92]">a.u.</span>
                </div>
                <div className="text-xs text-[#8c8c92] mt-1 font-mono">root-mean-square amplitude</div>
              </div>

              <div className="bg-[#f4f3ef] border border-[#e4e2db] rounded-[2px] p-5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#8c8c92] block">MAV</span>
                <div className="font-mono text-2xl font-bold text-[#15161b] mt-2">
                  {fmt(dataset.emgMetrics.mav, 4)} <span className="text-xs font-normal text-[#8c8c92]">a.u.</span>
                </div>
                <div className="text-xs text-[#8c8c92] mt-1 font-mono">mean absolute value</div>
              </div>

              <div className="bg-[#f4f3ef] border border-[#e4e2db] rounded-[2px] p-5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#8c8c92] block">Peak-to-Peak</span>
                <div className="font-mono text-2xl font-bold text-[#15161b] mt-2">
                  {fmt(dataset.emgMetrics.peakToPeak, 4)} <span className="text-xs font-normal text-[#8c8c92]">a.u.</span>
                </div>
                <div className="text-xs text-[#8c8c92] mt-1 font-mono">max &minus; min</div>
              </div>

              <div className="bg-[#f4f3ef] border border-[#e4e2db] rounded-[2px] p-5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#8c8c92] block">Zero-Crossing Rate</span>
                <div className="font-mono text-2xl font-bold text-[#15161b] mt-2">
                  {fmt(dataset.emgMetrics.zcr, 1)} <span className="text-xs font-normal text-[#8c8c92]">Hz</span>
                </div>
                <div className="text-xs text-[#8c8c92] mt-1 font-mono">frequency proxy</div>
              </div>
            </>
          )}

          {dataset.type === 'eeg' && dataset.eegMetrics && (
            <>
              {EEG_BANDS.map((b) => {
                const info = dataset.eegMetrics?.bands[b.key];
                const isDom = dataset.eegMetrics?.dominant === b.key;
                return (
                  <div key={b.key} className={`bg-[#f4f3ef] border border-[#e4e2db] rounded-[2px] p-5 ${isDom ? 'border-[#1d40d0]/50' : ''}`}>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#8c8c92] block">
                      {b.symbol} {b.label} ({b.lo}-{b.hi} Hz)
                    </span>
                    <div className={`font-mono text-2xl font-bold mt-2 ${isDom ? 'text-[#1d40d0]' : 'text-[#15161b]'}`}>
                      {fmt(info?.relative, 1)} <span className="text-xs font-normal text-[#8c8c92]">%</span>
                    </div>
                    <div className="text-xs text-[#8c8c92] mt-1 font-mono">
                      abs {fmt(info?.absolute, 3)} a.u.{isDom ? ' &bull; dominant' : ''}
                    </div>
                  </div>
                );
              })}
              <div className="bg-[#f4f3ef] border border-[#e4e2db] rounded-[2px] p-5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#8c8c92] block">Peak Frequency</span>
                <div className="font-mono text-2xl font-bold text-[#15161b] mt-2">
                  {fmt(dataset.eegMetrics.peakFreq, 2)} <span className="text-xs font-normal text-[#8c8c92]">Hz</span>
                </div>
                <div className="text-xs text-[#8c8c92] mt-1 font-mono">dominant: {dataset.eegMetrics.dominant}</div>
              </div>
            </>
          )}
        </div>

        {/* Signal Plot Card */}
        <div className="border border-[#e4e2db] rounded-[2px] p-5 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#15161b] font-mono">
              {dataset.type === 'ecg' ? 'ECG signal with detected R-peaks' : dataset.type === 'emg' ? 'EMG signal' : 'EEG signal'}
            </h4>
            {dataset.type === 'ecg' && (
              <span className="text-xs font-mono text-[#1d40d0] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#1d40d0]" /> R-peaks detected
              </span>
            )}
          </div>
          <div className="w-full h-80 bg-white">
            <canvas ref={signalCanvasRef} className="w-full h-full block" />
          </div>
          <p className="text-[11px] font-mono text-[#8c8c92] pt-1">
            Sampling rate {fmt(dataset.fs, 1)} Hz &bull; {dataset.amplitude.length.toLocaleString()} samples (displayed with min/max decimation).
          </p>
        </div>

        {/* EEG Band Power Bar Chart (Shown only when EEG is selected) */}
        {dataset.type === 'eeg' && (
          <div className="border border-[#e4e2db] rounded-[2px] p-5 space-y-2">
            <h4 className="text-sm font-bold text-[#15161b] font-mono">EEG band power</h4>
            <div className="w-full h-48 bg-white">
              <canvas ref={bandCanvasRef} className="w-full h-full block" />
            </div>
            <p className="text-[11px] font-mono text-[#8c8c92] pt-1">
              Relative power of each frequency band (&delta; Delta &bull; &theta; Theta &bull; &alpha; Alpha &bull; &beta; Beta).
            </p>
          </div>
        )}
      </section>

      {/* About the Metrics Card (Exact Swiss Reference section) */}
      <section className="bg-white border border-[#e4e2db] rounded-[2px] p-7 shadow-sm space-y-6">
        <h3 className="text-base font-bold text-[#15161b]">About the metrics</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h4 className="font-mono text-xs uppercase font-bold tracking-wider text-[#15161b] pb-2 border-b border-[#e4e2db] mb-3">
              ECG — Electrocardiogram
            </h4>
            <ul className="text-xs text-[#56565c] space-y-2 list-disc pl-4">
              <li><strong>Heart Rate</strong> — beats/min from detected R-peaks.</li>
              <li><strong>SDNN</strong> — standard deviation of RR (NN) intervals; overall HRV.</li>
              <li><strong>RMSSD</strong> — root mean square of successive RR differences; short-term HRV.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-xs uppercase font-bold tracking-wider text-[#15161b] pb-2 border-b border-[#e4e2db] mb-3">
              EMG — Electromyogram
            </h4>
            <ul className="text-xs text-[#56565c] space-y-2 list-disc pl-4">
              <li><strong>RMS</strong> — root-mean-square amplitude; muscle activation intensity.</li>
              <li><strong>MAV</strong> — mean absolute value; average rectified amplitude.</li>
              <li><strong>ZCR</strong> — zero-crossing rate; a rough frequency proxy.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-xs uppercase font-bold tracking-wider text-[#15161b] pb-2 border-b border-[#e4e2db] mb-3">
              EEG — Electroencephalogram
            </h4>
            <ul className="text-xs text-[#56565c] space-y-2 list-disc pl-4">
              <li><strong>Delta</strong> 0.5–4 Hz &bull; <strong>Theta</strong> 4–8 Hz</li>
              <li><strong>Alpha</strong> 8–13 Hz &bull; <strong>Beta</strong> 13–30 Hz</li>
              <li>Band power is estimated with a windowed FFT.</li>
            </ul>
          </div>
        </div>

        {/* Expected CSV format collapsible */}
        <details className="pt-4 border-t border-[#e4e2db] text-xs font-mono text-[#56565c] cursor-pointer">
          <summary className="font-bold text-[#15161b]">Expected CSV format</summary>
          <div className="mt-3 space-y-2 pl-2">
            <p>The analyzer accepts comma-, semicolon-, tab- or space-separated values, with or without a header row:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>One column</strong> — amplitude samples. The sampling rate field is used as the time base.</li>
              <li><strong>Two columns</strong> — <code>time, amplitude</code>. Time is assumed to be in <em>seconds</em>; the sampling rate is auto-detected.</li>
            </ul>
            <pre className="bg-[#15161b] text-[#eceae3] p-4 rounded-[2px] overflow-x-auto text-xs mt-2">
time,amplitude
0.000,-0.012
0.004,0.031
0.008,0.085
...
            </pre>
          </div>
        </details>
      </section>

      {/* Disclaimer */}
      <div className="border-y border-[#e4e2db] py-4 text-xs font-mono text-[#56565c] flex items-center">
        <span className="uppercase tracking-widest text-[#8c8c92] mr-3 font-bold text-[10px]">Note</span>
        <span><strong>For research &amp; educational use only.</strong> This tool is not a medical device and must not be used for diagnosis or treatment decisions.</span>
      </div>

    </div>
  );
};
