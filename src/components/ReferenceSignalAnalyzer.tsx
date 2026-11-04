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
  AlertCircle,
  Activity,
  Brain,
  Sliders
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

  // Zoom & Pan
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1x, 2x, 5x, 10x
  const [scrollProgress, setScrollProgress] = useState<number>(0); // 0 to 1

  // Cardiologist Digital Calipers
  const [caliperActive, setCaliperActive] = useState<boolean>(false);
  const [caliperStart, setCaliperStart] = useState<{ time: number; amp: number } | null>(null);
  const [caliperEnd, setCaliperEnd] = useState<{ time: number; amp: number } | null>(null);
  const [isDraggingCaliper, setIsDraggingCaliper] = useState<boolean>(false);

  // Beat Annotations & Template Modal
  const [showBeatAnnotations, setShowBeatAnnotations] = useState<boolean>(true);
  const [showBeatTemplate, setShowBeatTemplate] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const signalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bandCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const templateCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Current Analyzed Signal
  const [dataset, setDataset] = useState<AnalyzedSignalData>(() => {
    const synth = generateSyntheticECG('normal', 12, 250, 72);
    return analyzeAnySignal('ecg', 'synthetic_ecg.csv', synth.time, synth.amplitude, 250, false);
  });

  // Load a synthetic sample
  const handleLoadSample = useCallback((type: SignalCategory) => {
    setSignalType(type);
    setStatusMsg(null);
    setCaliperStart(null);
    setCaliperEnd(null);
    setZoomLevel(1);
    setScrollProgress(0);

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
    setCaliperStart(null);
    setCaliperEnd(null);
    setZoomLevel(1);
    setScrollProgress(0);
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
    setCaliperStart(null);
    setCaliperEnd(null);
    setZoomLevel(1);
    setScrollProgress(0);
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

  // Canvas Mouse Coordinates to Time & Voltage Conversion
  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = signalCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const marginL = 55;
    const marginB = 35;
    const marginT = 15;
    const marginR = 15;
    const plotW = rect.width - marginL - marginR;
    const plotH = rect.height - marginB - marginT;

    const duration = dataset.duration || 1;
    const visibleDuration = duration / zoomLevel;
    const maxScroll = Math.max(0, duration - visibleDuration);
    const startTime = scrollProgress * maxScroll;

    const clampedX = Math.max(marginL, Math.min(rect.width - marginR, x));
    const tFrac = (clampedX - marginL) / plotW;
    const timeAt = startTime + tFrac * visibleDuration;

    const minVal = dataset.min;
    const maxVal = dataset.max;
    const rangeY = (maxVal - minVal) || 1;
    const clampedY = Math.max(marginT, Math.min(rect.height - marginB, y));
    const yFrac = 1 - (clampedY - marginT) / plotH;
    const ampAt = minVal + yFrac * rangeY;

    return { time: timeAt, amp: ampAt, px: clampedX, py: clampedY };
  }, [dataset, zoomLevel, scrollProgress]);

  // Caliper Mouse Handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!caliperActive) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;
    setCaliperStart({ time: coords.time, amp: coords.amp });
    setCaliperEnd({ time: coords.time, amp: coords.amp });
    setIsDraggingCaliper(true);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!caliperActive || !isDraggingCaliper) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;
    setCaliperEnd({ time: coords.time, amp: coords.amp });
  };

  const handleCanvasMouseUp = () => {
    if (isDraggingCaliper) {
      setIsDraggingCaliper(false);
    }
  };

  // Render Time-domain Waveform on Canvas with decimation, R-peaks, Zoom, and Calipers
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

    // Viewport Time Window
    const duration = dataset.duration || 1;
    const visibleDuration = duration / zoomLevel;
    const maxScroll = Math.max(0, duration - visibleDuration);
    const startTime = scrollProgress * maxScroll;
    const endTime = startTime + visibleDuration;

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

    const xSteps = 6;
    for (let i = 0; i <= xSteps; i++) {
      const x = marginL + (i / xSteps) * plotW;
      const t = startTime + (i / xSteps) * visibleDuration;
      ctx.moveTo(x, marginT);
      ctx.lineTo(x, height - marginB);
      ctx.fillText(`${t.toFixed(2)}s`, x - 12, height - 12);
    }
    ctx.stroke();

    // Axis Border
    ctx.strokeStyle = '#e4e2db';
    ctx.strokeRect(marginL, marginT, plotW, plotH);

    // Filter points within visible viewport
    const totalPts = dataset.time.length;
    let startIdx = 0;
    while (startIdx < totalPts && dataset.time[startIdx] < startTime) startIdx++;
    let endIdx = startIdx;
    while (endIdx < totalPts && dataset.time[endIdx] <= endTime) endIdx++;
    startIdx = Math.max(0, startIdx - 1);
    endIdx = Math.min(totalPts, endIdx + 1);

    const viewTime = dataset.time.slice(startIdx, endIdx);
    const viewAmp = dataset.amplitude.slice(startIdx, endIdx);

    // Decimated line plot for visible slice
    const pts = decimateSignal(viewTime, viewAmp, 3000);
    if (pts.length > 1) {
      ctx.strokeStyle = '#15161b';
      ctx.lineWidth = 1.3;
      ctx.beginPath();

      for (let i = 0; i < pts.length; i++) {
        const x = marginL + ((pts[i].x - startTime) / visibleDuration) * plotW;
        const y = marginT + (1 - (pts[i].y - minVal) / rangeY) * plotH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // For ECG, overlay detected R-peaks & Trained ML beat classifications
      if (dataset.type === 'ecg' && dataset.ecgMetrics && dataset.ecgMetrics.rPeaks.length > 0) {
        const mlBeats = dataset.ecgMetrics.mlReport?.beatDiagnoses;

        for (let bIdx = 0; bIdx < dataset.ecgMetrics.rPeaks.length; bIdx++) {
          const idx = dataset.ecgMetrics.rPeaks[bIdx];
          const ptTime = dataset.time[idx];
          const ptAmp = dataset.amplitude[idx];

          if (ptTime !== undefined && ptAmp !== undefined && ptTime >= startTime && ptTime <= endTime) {
            const px = marginL + ((ptTime - startTime) / visibleDuration) * plotW;
            const py = marginT + (1 - (ptAmp - minVal) / rangeY) * plotH;

            const diag = mlBeats ? mlBeats[bIdx] : null;
            const beatColor = diag ? diag.color : '#1d40d0';

            // R-peak circle
            ctx.fillStyle = beatColor;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(px, py, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Beat Label Tag (N, PVC, APC)
            if (showBeatAnnotations && diag) {
              ctx.font = 'bold 9px ui-monospace, monospace';
              const tagText = diag.classification;
              const tagW = ctx.measureText(tagText).width + 8;
              const tagY = py - 18;

              ctx.fillStyle = beatColor;
              ctx.fillRect(px - tagW / 2, tagY, tagW, 14);

              ctx.fillStyle = '#ffffff';
              ctx.fillText(tagText, px - tagW / 2 + 4, tagY + 10);
            }
          }
        }
      }
    }

    // Render Digital Calipers overlay
    if (caliperStart && caliperEnd) {
      const t1 = Math.min(caliperStart.time, caliperEnd.time);
      const t2 = Math.max(caliperStart.time, caliperEnd.time);
      const x1 = marginL + ((t1 - startTime) / visibleDuration) * plotW;
      const x2 = marginL + ((t2 - startTime) / visibleDuration) * plotW;

      // Shaded range
      ctx.fillStyle = 'rgba(217, 119, 6, 0.12)';
      ctx.fillRect(Math.max(marginL, x1), marginT, Math.min(plotW, x2 - x1), plotH);

      // Caliper vertical lines
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);

      if (x1 >= marginL && x1 <= width - marginR) {
        ctx.beginPath();
        ctx.moveTo(x1, marginT);
        ctx.lineTo(x1, marginT + plotH);
        ctx.stroke();
      }

      if (x2 >= marginL && x2 <= width - marginR) {
        ctx.beginPath();
        ctx.moveTo(x2, marginT);
        ctx.lineTo(x2, marginT + plotH);
        ctx.stroke();
      }

      ctx.setLineDash([]);

      // Top horizontal connector & measurement text badge
      if (x2 - x1 > 8) {
        const midX = (Math.max(marginL, x1) + Math.min(width - marginR, x2)) / 2;
        const deltaMs = (t2 - t1) * 1000;
        const bpm = deltaMs > 0 ? (60000 / deltaMs).toFixed(0) : '—';
        const deltaMv = Math.abs(caliperEnd.amp - caliperStart.amp).toFixed(3);
        const smallBoxes = (deltaMs / 40).toFixed(1);

        const badgeText = `Δt: ${deltaMs.toFixed(1)}ms (${bpm} BPM) | ΔV: ${deltaMv}mV | ${smallBoxes} boxes`;
        ctx.font = 'bold 10px ui-monospace, monospace';
        const bw = ctx.measureText(badgeText).width + 14;

        ctx.fillStyle = '#15161b';
        ctx.fillRect(midX - bw / 2, marginT + 8, bw, 20);
        ctx.strokeStyle = '#d97706';
        ctx.strokeRect(midX - bw / 2, marginT + 8, bw, 20);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(badgeText, midX - bw / 2 + 7, marginT + 22);
      }
    }
  }, [dataset, zoomLevel, scrollProgress, caliperStart, caliperEnd, showBeatAnnotations]);

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

  // Render Average Beat Template Canvas
  useEffect(() => {
    if (!showBeatTemplate || !dataset.ecgMetrics?.beatTemplate) return;
    const canvas = templateCanvasRef.current;
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

    const tmpl = dataset.ecgMetrics.beatTemplate;
    const marginL = 50, marginR = 20, marginT = 20, marginB = 30;
    const plotW = width - marginL - marginR;
    const plotH = height - marginT - marginB;

    let minVal = Infinity, maxVal = -Infinity;
    for (let i = 0; i < tmpl.meanCurve.length; i++) {
      if (tmpl.stdLower[i] < minVal) minVal = tmpl.stdLower[i];
      if (tmpl.stdUpper[i] > maxVal) maxVal = tmpl.stdUpper[i];
    }
    const rangeY = (maxVal - minVal) || 1;
    const nPts = tmpl.meanCurve.length;

    // Grid
    ctx.strokeStyle = '#eeece6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marginL, marginT + plotH / 2);
    ctx.lineTo(width - marginR, marginT + plotH / 2);
    ctx.stroke();

    // Standard deviation shaded envelope
    ctx.fillStyle = 'rgba(29, 64, 208, 0.12)';
    ctx.beginPath();
    for (let i = 0; i < nPts; i++) {
      const x = marginL + (i / (nPts - 1)) * plotW;
      const y = marginT + (1 - (tmpl.stdUpper[i] - minVal) / rangeY) * plotH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let i = nPts - 1; i >= 0; i--) {
      const x = marginL + (i / (nPts - 1)) * plotW;
      const y = marginT + (1 - (tmpl.stdLower[i] - minVal) / rangeY) * plotH;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Mean Beat Curve
    ctx.strokeStyle = '#1d40d0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < nPts; i++) {
      const x = marginL + (i / (nPts - 1)) * plotW;
      const y = marginT + (1 - (tmpl.meanCurve[i] - minVal) / rangeY) * plotH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // R-peak zero vertical reference line
    const zeroX = marginL + (250 / 700) * plotW;
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(zeroX, marginT);
    ctx.lineTo(zeroX, marginT + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Zero label
    ctx.fillStyle = '#d97706';
    ctx.font = 'bold 9px ui-monospace, monospace';
    ctx.fillText('R-peak (0 ms)', zeroX + 4, marginT + 12);
  }, [showBeatTemplate, dataset]);

  // Download CSV
  const handleDownloadCSV = () => {
    let csv = `Biomedical Signal Analyzer — Comprehensive Clinical Results\n`;
    csv += `Generated,${new Date().toISOString()}\n`;
    csv += `File,${dataset.fileName}\n`;
    csv += `Signal type,${dataset.type.toUpperCase()}\n`;
    csv += `Samples,${dataset.amplitude.length}\n`;
    csv += `Duration (s),${fmt(dataset.duration, 4)}\n`;
    csv += `Sampling rate (Hz),${fmt(dataset.fs, 4)}\n`;
    csv += `Amplitude range,${fmt(dataset.min, 4)} to ${fmt(dataset.max, 4)} mV\n\n`;

    csv += `Metric,Value,Unit\n`;
    if (dataset.type === 'ecg' && dataset.ecgMetrics) {
      const m = dataset.ecgMetrics;
      csv += `Heart Rate,${fmt(m.heartRate, 1)},bpm\n`;
      csv += `Beats Detected,${m.beatsCount},count\n`;
      csv += `Mean RR,${fmt(m.hrv.meanRR, 1)},ms\n`;
      csv += `SDNN,${fmt(m.hrv.sdnn, 1)},ms\n`;
      csv += `RMSSD,${fmt(m.hrv.rmssd, 1)},ms\n`;
      csv += `pNN50,${fmt(m.hrv.pnn50, 1)},%\n`;
      csv += `PR Interval,${fmt(m.intervals.prIntervalMs, 1)},ms\n`;
      csv += `QRS Duration,${fmt(m.intervals.qrsDurationMs, 1)},ms\n`;
      csv += `QT Interval,${fmt(m.intervals.qtIntervalMs, 1)},ms\n`;
      csv += `QTc Bazett,${fmt(m.intervals.qtcMs, 1)},ms\n`;
      csv += `QTc Fridericia,${fmt(m.intervals.qtcFridericiaMs, 1)},ms\n`;
      csv += `ST Deviation,${fmt(m.intervals.stDeviationMv, 3)},mV\n`;
      csv += `LF/HF Ratio,${fmt(m.hrv.lfHfRatio, 2)},ratio\n`;
      csv += `Sample Entropy,${fmt(m.hrv.sampleEntropy, 3)},a.u.\n`;
      csv += `AI Rhythm Diagnosis,"${m.rhythmInterpretation}",\n`;
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
        app: 'Biomedical Signal Analyzer & Arrhythmia Diagnostic System',
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

  const ml = dataset.ecgMetrics?.mlReport;

  return (
    <div className="max-w-5xl mx-auto space-y-7 text-[#15161b] font-sans">
      
      {/* Intro Hero Section (Exact reference styling) */}
      <section className="pt-4 pb-2 max-w-2xl">
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#15161b] leading-tight">
          Analyze biomedical signals in seconds
        </h2>
        <p className="text-base text-[#56565c] mt-3 leading-relaxed">
          Upload a CSV recording of an <strong>ECG</strong>, <strong>EMG</strong> or <strong>EEG</strong> signal and the analyzer automatically computes the relevant clinical metrics, extracts waveforms with sub-sample precision, and evaluates arrhythmias using trained ML models — entirely in your browser.
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
              Determines which clinical metrics and AI models are activated.
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
              Auto-detected when time column is present in uploaded CSV.
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
          <span className="text-[#8c8c92]">Instant Benchmarks:</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleLoadSample('ecg')}
              className={`px-3 py-1 border rounded-[2px] font-semibold transition-colors ${
                signalType === 'ecg' ? 'bg-[#15161b] text-white border-[#15161b]' : 'border-[#e4e2db] bg-[#f4f3ef] text-[#15161b] hover:border-[#15161b]'
              }`}
            >
              ECG Normal
            </button>
            <button
              onClick={() => handleLoadSample('emg')}
              className={`px-3 py-1 border rounded-[2px] font-semibold transition-colors ${
                signalType === 'emg' ? 'bg-[#15161b] text-white border-[#15161b]' : 'border-[#e4e2db] bg-[#f4f3ef] text-[#15161b] hover:border-[#15161b]'
              }`}
            >
              EMG Burst
            </button>
            <button
              onClick={() => handleLoadSample('eeg')}
              className={`px-3 py-1 border rounded-[2px] font-semibold transition-colors ${
                signalType === 'eeg' ? 'bg-[#15161b] text-white border-[#15161b]' : 'border-[#e4e2db] bg-[#f4f3ef] text-[#15161b] hover:border-[#15161b]'
              }`}
            >
              EEG Alpha
            </button>
            <button
              onClick={() => handleLoadPresetFile('ecg_normal.csv', 'MIT-BIH Normal Sinus')}
              className="px-3 py-1 border border-[#e4e2db] bg-[#f4f3ef] text-[#15161b] hover:border-[#1d40d0] rounded-[2px]"
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
              PVC Ectopy
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
            <span>Results &amp; Diagnostics</span>
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
            <dd className="font-bold text-[#15161b] mt-1">{fmt(dataset.min, 2)} … {fmt(dataset.max, 2)} mV</dd>
          </div>
        </dl>

        {/* TRAINED ML ARRHYTHMIA CLASSIFIER EXECUTIVE BANNER (For ECG) */}
        {dataset.type === 'ecg' && ml && (
          <div className={`border rounded-[2px] p-5 space-y-4 font-mono ${
            ml.severity === 'critical'
              ? 'bg-rose-50/70 border-rose-300'
              : ml.severity === 'high-risk'
              ? 'bg-amber-50/70 border-amber-300'
              : 'bg-emerald-50/50 border-emerald-300'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3 border-current/15">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold bg-[#15161b] text-white">
                    Trained ML Model &bull; MIT-BIH
                  </span>
                  <span className="text-xs text-[#56565c]">
                    Confidence: <strong>{ml.confidenceScore}%</strong>
                  </span>
                </div>
                <h4 className="text-xl font-bold mt-1.5 text-[#15161b]">
                  {ml.rhythmDiagnosis}
                </h4>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-1 bg-white border border-[#e4e2db] rounded text-[#15161b]">
                  Normal: <strong>{ml.classCounts.normal}</strong>
                </span>
                <span className="px-2.5 py-1 bg-white border border-[#e4e2db] rounded text-[#ef4444]">
                  PVC: <strong>{ml.classCounts.pvc}</strong>
                </span>
                <span className="px-2.5 py-1 bg-white border border-[#e4e2db] rounded text-[#8b5cf6]">
                  APC: <strong>{ml.classCounts.apc}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setShowBeatTemplate(!showBeatTemplate)}
                  className="px-3 py-1 bg-[#1d40d0] hover:bg-[#15161b] text-white rounded font-bold transition-colors flex items-center gap-1"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>{showBeatTemplate ? 'Hide Template' : 'Beat Template (±1 SD)'}</span>
                </button>
              </div>
            </div>

            {/* Model Probability Breakdown Bars */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-[11px]">
              <div>
                <div className="flex justify-between text-[#56565c] mb-1">
                  <span>Normal Sinus</span>
                  <span className="font-bold">{ml.probabilities.normalSinus}%</span>
                </div>
                <div className="h-1.5 bg-black/10 rounded overflow-hidden">
                  <div className="h-full bg-emerald-600" style={{ width: `${ml.probabilities.normalSinus}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[#56565c] mb-1">
                  <span>Ventricular (PVC)</span>
                  <span className="font-bold text-[#ef4444]">{ml.probabilities.ventricularEctopy}%</span>
                </div>
                <div className="h-1.5 bg-black/10 rounded overflow-hidden">
                  <div className="h-full bg-rose-500" style={{ width: `${ml.probabilities.ventricularEctopy}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[#56565c] mb-1">
                  <span>Atrial Fibrillation</span>
                  <span className="font-bold text-[#d97706]">{ml.probabilities.atrialFibrillation}%</span>
                </div>
                <div className="h-1.5 bg-black/10 rounded overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${ml.probabilities.atrialFibrillation}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[#56565c] mb-1">
                  <span>Conduction Block</span>
                  <span className="font-bold">{ml.probabilities.bundleBranchBlock}%</span>
                </div>
                <div className="h-1.5 bg-black/10 rounded overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${ml.probabilities.bundleBranchBlock}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[#56565c] mb-1">
                  <span>Bradycardia</span>
                  <span className="font-bold">{ml.probabilities.bradycardia}%</span>
                </div>
                <div className="h-1.5 bg-black/10 rounded overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${ml.probabilities.bradycardia}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[#56565c] mb-1">
                  <span>ST Deviation / STEMI</span>
                  <span className="font-bold">{ml.probabilities.stemiOrIschemia}%</span>
                </div>
                <div className="h-1.5 bg-black/10 rounded overflow-hidden">
                  <div className="h-full bg-purple-500" style={{ width: `${ml.probabilities.stemiOrIschemia}%` }} />
                </div>
              </div>
            </div>

            {/* Recommendation line */}
            <p className="text-xs text-[#56565c] pt-1">
              <strong>Clinical Finding:</strong> {ml.clinicalFindings[0]} &bull; {ml.recommendation}
            </p>
          </div>
        )}

        {/* Average Beat Template Viewer (Modal/Inline Drawer) */}
        {showBeatTemplate && dataset.ecgMetrics?.beatTemplate && (
          <div className="bg-[#faf9f6] border border-[#1d40d0]/30 rounded-[2px] p-5 space-y-3 font-mono">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#1d40d0] flex items-center gap-1.5">
                  <Activity className="w-4 h-4" />
                  <span>Averaged P-QRS-T Beat Template ({dataset.ecgMetrics.beatTemplate.totalBeatsAveraged} beats superimposed)</span>
                </h4>
                <p className="text-[11px] text-[#8c8c92] mt-0.5">
                  Sub-sample R-peak aligned mean waveform with ±1 standard deviation morphology confidence envelope.
                </p>
              </div>
              <button 
                onClick={() => setShowBeatTemplate(false)}
                className="text-xs text-[#8c8c92] hover:text-[#15161b] underline"
              >
                Close
              </button>
            </div>
            <div className="w-full h-48 bg-white border border-[#e4e2db] rounded-[2px]">
              <canvas ref={templateCanvasRef} className="w-full h-full block" />
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-[#56565c]">
              <span>ST-Deviation: <strong>{fmt(dataset.ecgMetrics.intervals.stDeviationMv, 3)} mV</strong></span>
              <span>PR-Interval: <strong>{fmt(dataset.ecgMetrics.intervals.prIntervalMs, 1)} ms</strong></span>
              <span>QRS-Duration: <strong>{fmt(dataset.ecgMetrics.intervals.qrsDurationMs, 1)} ms</strong></span>
              <span>QTc (Fridericia): <strong>{fmt(dataset.ecgMetrics.intervals.qtcFridericiaMs, 1)} ms</strong></span>
            </div>
          </div>
        )}

        {/* Primary Metric Cards Grid (Swiss Hairline Architecture) */}
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
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#8c8c92] block">Mean RR</span>
                <div className="font-mono text-3xl font-bold text-[#15161b] mt-2">
                  {fmt(dataset.ecgMetrics.hrv.meanRR, 1)} <span className="text-xs font-normal text-[#8c8c92]">ms</span>
                </div>
                <div className="text-xs text-[#8c8c92] mt-1 font-mono">sub-sample parabolic</div>
              </div>

              <div className="bg-[#f4f3ef] border border-[#e4e2db] rounded-[2px] p-5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#8c8c92] block">SDNN</span>
                <div className="font-mono text-3xl font-bold text-[#15161b] mt-2">
                  {fmt(dataset.ecgMetrics.hrv.sdnn, 1)} <span className="text-xs font-normal text-[#8c8c92]">ms</span>
                </div>
                <div className="text-xs text-[#8c8c92] mt-1 font-mono">overall HRV (autonomic)</div>
              </div>

              <div className="bg-[#f4f3ef] border border-[#e4e2db] rounded-[2px] p-5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#8c8c92] block">RMSSD</span>
                <div className="font-mono text-3xl font-bold text-[#15161b] mt-2">
                  {fmt(dataset.ecgMetrics.hrv.rmssd, 1)} <span className="text-xs font-normal text-[#8c8c92]">ms</span>
                </div>
                <div className="text-xs text-[#8c8c92] mt-1 font-mono">parasympathetic vagal</div>
              </div>

              <div className="bg-[#f4f3ef] border border-[#e4e2db] rounded-[2px] p-5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#8c8c92] block">Signal Quality</span>
                <div className="font-mono text-3xl font-bold text-emerald-600 mt-2">
                  {dataset.ecgMetrics.sqi.overallScore}%
                </div>
                <div className="text-xs text-[#8c8c92] mt-1 font-mono">SNR: {dataset.ecgMetrics.sqi.snrDb} dB</div>
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

        {/* CLINICAL INTERVALS & ADVANCED SPECTRAL HRV SPEC ROW (ECG Mode) */}
        {dataset.type === 'ecg' && dataset.ecgMetrics && (
          <div className="bg-[#faf9f6] border border-[#e4e2db] p-5 rounded-[2px] space-y-3 font-mono">
            <span className="text-[10px] uppercase tracking-widest text-[#8c8c92] font-bold block">
              Cardiology Conduction Intervals &amp; Spectral HRV
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
              <div className="bg-white border border-[#e4e2db] p-2.5 rounded-[2px]">
                <span className="text-[#8c8c92] block text-[10px]">PR INTERVAL</span>
                <span className="font-bold text-sm text-[#15161b] mt-0.5 block">
                  {fmt(dataset.ecgMetrics.intervals.prIntervalMs, 1)} ms
                </span>
                <span className="text-[10px] text-[#8c8c92]">120-200 normal</span>
              </div>
              <div className="bg-white border border-[#e4e2db] p-2.5 rounded-[2px]">
                <span className="text-[#8c8c92] block text-[10px]">QRS DURATION</span>
                <span className="font-bold text-sm text-[#15161b] mt-0.5 block">
                  {fmt(dataset.ecgMetrics.intervals.qrsDurationMs, 1)} ms
                </span>
                <span className="text-[10px] text-[#8c8c92]">&lt;120 ms normal</span>
              </div>
              <div className="bg-white border border-[#e4e2db] p-2.5 rounded-[2px]">
                <span className="text-[#8c8c92] block text-[10px]">QT INTERVAL</span>
                <span className="font-bold text-sm text-[#15161b] mt-0.5 block">
                  {fmt(dataset.ecgMetrics.intervals.qtIntervalMs, 1)} ms
                </span>
                <span className="text-[10px] text-[#8c8c92]">raw uncorrected</span>
              </div>
              <div className="bg-white border border-[#e4e2db] p-2.5 rounded-[2px]">
                <span className="text-[#8c8c92] block text-[10px]">QTC (BAZETT)</span>
                <span className="font-bold text-sm text-[#1d40d0] mt-0.5 block">
                  {fmt(dataset.ecgMetrics.intervals.qtcMs, 1)} ms
                </span>
                <span className="text-[10px] text-[#8c8c92]">&lt;450 ms normal</span>
              </div>
              <div className="bg-white border border-[#e4e2db] p-2.5 rounded-[2px]">
                <span className="text-[#8c8c92] block text-[10px]">QTC (FRIDERICIA)</span>
                <span className="font-bold text-sm text-[#15161b] mt-0.5 block">
                  {fmt(dataset.ecgMetrics.intervals.qtcFridericiaMs, 1)} ms
                </span>
                <span className="text-[10px] text-[#8c8c92]">cube-root scale</span>
              </div>
              <div className="bg-white border border-[#e4e2db] p-2.5 rounded-[2px]">
                <span className="text-[#8c8c92] block text-[10px]">LF / HF RATIO</span>
                <span className="font-bold text-sm text-[#15161b] mt-0.5 block">
                  {fmt(dataset.ecgMetrics.hrv.lfHfRatio, 2)}
                </span>
                <span className="text-[10px] text-[#8c8c92]">sympathovagal</span>
              </div>
              <div className="bg-white border border-[#e4e2db] p-2.5 rounded-[2px]">
                <span className="text-[#8c8c92] block text-[10px]">SAMPLE ENTROPY</span>
                <span className="font-bold text-sm text-[#15161b] mt-0.5 block">
                  {fmt(dataset.ecgMetrics.hrv.sampleEntropy, 3)}
                </span>
                <span className="text-[10px] text-[#8c8c92]">SampEn rhythm</span>
              </div>
            </div>
          </div>
        )}

        {/* Signal Plot Card with Zoom, Pan, Calipers, and Beat Badges */}
        <div className="border border-[#e4e2db] rounded-[2px] p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono">
            <div>
              <h4 className="text-sm font-bold text-[#15161b]">
                {dataset.type === 'ecg' ? 'ECG Waveform & Caliper Inspection' : dataset.type === 'emg' ? 'EMG Signal' : 'EEG Signal'}
              </h4>
              <p className="text-[11px] text-[#8c8c92]">
                {caliperActive 
                  ? 'Digital Calipers Active: Click and drag anywhere to measure intervals (ms, mV, BPM)' 
                  : 'Zoom or toggle Calipers above to measure intervals with medical precision.'}
              </p>
            </div>

            {/* Interactive Toolbars */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Zoom Buttons */}
              <div className="inline-flex border border-[#e4e2db] rounded-[2px] overflow-hidden bg-white">
                {[1, 2, 5, 10].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => { setZoomLevel(z); setScrollProgress(0); }}
                    className={`px-2.5 py-1 border-r last:border-r-0 border-[#e4e2db] font-semibold transition-colors ${
                      zoomLevel === z ? 'bg-[#15161b] text-white' : 'text-[#56565c] hover:bg-[#f4f3ef]'
                    }`}
                  >
                    {z}x
                  </button>
                ))}
              </div>

              {/* Digital Calipers Toggle */}
              <button
                type="button"
                onClick={() => {
                  setCaliperActive(!caliperActive);
                  if (caliperActive) { setCaliperStart(null); setCaliperEnd(null); }
                }}
                className={`px-3 py-1 rounded-[2px] font-semibold transition-colors flex items-center gap-1.5 border ${
                  caliperActive 
                    ? 'bg-amber-600 text-white border-amber-600' 
                    : 'bg-white text-[#15161b] border-[#e4e2db] hover:border-[#15161b]'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{caliperActive ? 'Calipers ON' : 'Digital Calipers'}</span>
              </button>

              {/* Beat Tags Toggle for ECG */}
              {dataset.type === 'ecg' && (
                <button
                  type="button"
                  onClick={() => setShowBeatAnnotations(!showBeatAnnotations)}
                  className={`px-3 py-1 rounded-[2px] font-semibold transition-colors flex items-center gap-1.5 border ${
                    showBeatAnnotations 
                      ? 'bg-[#1d40d0] text-white border-[#1d40d0]' 
                      : 'bg-white text-[#56565c] border-[#e4e2db] hover:border-[#15161b]'
                  }`}
                >
                  <Brain className="w-3.5 h-3.5" />
                  <span>Beat Tags</span>
                </button>
              )}
            </div>
          </div>

          {/* Canvas Waveform Display */}
          <div className="w-full h-84 bg-white relative cursor-crosshair">
            <canvas 
              ref={signalCanvasRef} 
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              className="w-full h-full block" 
            />
          </div>

          {/* Minimap / Horizontal Scroller when Zoomed */}
          {zoomLevel > 1 && (
            <div className="pt-2 font-mono text-xs flex items-center gap-3">
              <span className="text-[#8c8c92] shrink-0">Viewport:</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.005"
                value={scrollProgress}
                onChange={(e) => setScrollProgress(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#f4f3ef] rounded-lg appearance-none cursor-pointer accent-[#1d40d0]"
              />
              <span className="text-[#56565c] shrink-0 font-bold">
                {((scrollProgress * (dataset.duration - dataset.duration / zoomLevel))).toFixed(1)}s &ndash; {((scrollProgress * (dataset.duration - dataset.duration / zoomLevel)) + (dataset.duration / zoomLevel)).toFixed(1)}s
              </span>
            </div>
          )}

          <p className="text-[11px] font-mono text-[#8c8c92] pt-1">
            Sampling rate {fmt(dataset.fs, 1)} Hz &bull; {dataset.amplitude.length.toLocaleString()} samples &bull; High-precision parabolic peak refinement.
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

        <div className="space-y-4 text-sm text-[#56565c] leading-relaxed">
          <p>
            <strong>ECG (Electrocardiogram):</strong> Measures cardiac electrical activity. Detected peaks correspond to the R-wave of the QRS complex. The algorithm calculates the heart rate in beats per minute (BPM), mean RR interval, and Heart Rate Variability (HRV) metrics including <em>SDNN</em> (standard deviation of normal-to-normal intervals), <em>RMSSD</em> (root mean square of successive differences), clinical conduction intervals (PR, QRS, QT, QTc), and trained ML arrhythmia classification.
          </p>
          <p>
            <strong>EMG (Electromyogram):</strong> Measures electrical activity produced by skeletal muscles. The Root Mean Square (RMS) and Mean Absolute Value (MAV) quantify signal amplitude and muscle activation level. The Zero-Crossing Rate (ZCR) estimates the dominant frequency content.
          </p>
          <p>
            <strong>EEG (Electroencephalogram):</strong> Measures brain electrical activity. Spectral analysis decomposes the signal into standardized frequency bands: Delta (0.5–4 Hz), Theta (4–8 Hz), Alpha (8–13 Hz), and Beta (13–30 Hz).
          </p>
        </div>

        {/* Expected CSV format collapsible */}
        <details className="text-xs text-[#56565c] font-mono border-t border-[#eeece6] pt-4">
          <summary className="cursor-pointer font-bold text-[#15161b] hover:text-[#1d40d0] select-none">
            Expected CSV format &bull; Details
          </summary>
          <div className="mt-3 bg-[#f4f3ef] border border-[#e4e2db] p-4 rounded-[2px] space-y-2">
            <p><strong>Two columns (time + amplitude):</strong></p>
            <pre className="text-[11px] text-[#15161b]">{`time,amplitude\n0.000,0.123\n0.004,0.145\n0.008,0.160`}</pre>
            <p className="pt-2"><strong>Single column (amplitude only, time inferred from sampling rate):</strong></p>
            <pre className="text-[11px] text-[#15161b]">{`amplitude\n0.123\n0.145\n0.160`}</pre>
          </div>
        </details>

        {/* Clinical Disclaimer */}
        <div className="border-t border-[#eeece6] pt-4 text-[11px] font-mono text-[#8c8c92]">
          <strong>Notice:</strong> This system is intended for research, engineering, and educational use only. It is not a certified medical device and must not be used for primary diagnostic purposes or emergency triage.
        </div>
      </section>

    </div>
  );
};
