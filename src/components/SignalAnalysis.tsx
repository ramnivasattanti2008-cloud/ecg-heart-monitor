import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useECG } from '../context/ECGContext';
import { 
  Sliders, 
  Filter, 
  BarChart3
} from 'lucide-react';
import { applyECGFilters } from '../utils/biquadFilters';
import { computeFFTSpectrum } from '../utils/fft';

export const SignalAnalysis: React.FC = () => {
  const { currentDataset, filterSettings, setFilterSettings } = useECG();

  const [compareMode, setCompareMode] = useState<'overlay' | 'stacked'>('overlay');
  const [zoomWindowSec, setZoomWindowSec] = useState<number>(6); // Show 6s by default
  const [zoomOffsetSec, setZoomOffsetSec] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fftCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const fs = currentDataset.samplingRate;
  const rawAmp = currentDataset.rawAmplitude;
  const time = currentDataset.time;
  const analysis = currentDataset.analysis;

  // Filter signal dynamically based on active filter settings
  const processedSignal = useMemo(() => {
    return applyECGFilters(rawAmp, fs, {
      removeBaseline: filterSettings.removeBaseline,
      notch50: filterSettings.notchFilter50Hz,
      notch60: filterSettings.notchFilter60Hz,
      lowpass40: filterSettings.lowpass40Hz,
    });
  }, [rawAmp, fs, filterSettings]);

  // Compute FFT Power Spectrum for both raw and filtered signals
  const fftRaw = useMemo(() => {
    return computeFFTSpectrum(rawAmp.slice(0, 4096), fs, 60);
  }, [rawAmp, fs]);

  const fftFiltered = useMemo(() => {
    return computeFFTSpectrum(processedSignal.slice(0, 4096), fs, 60);
  }, [processedSignal, fs]);

  // Windowed data slice for detailed inspection
  const maxSec = analysis.durationSeconds || 10;
  const startSample = Math.max(0, Math.round(zoomOffsetSec * fs));
  const endSample = Math.min(rawAmp.length, Math.round((zoomOffsetSec + zoomWindowSec) * fs));

  const sliceTime = time.slice(startSample, endSample);
  const sliceRaw = rawAmp.slice(startSample, endSample);
  const sliceFiltered = Array.from(processedSignal.slice(startSample, endSample));

  // Render Time-Domain Waveforms (Raw vs Filtered)
  useEffect(() => {
    const canvas = canvasRef.current;
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

    // Subtle Medical Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < width; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    if (sliceTime.length < 2) return;

    const n = sliceTime.length;
    const stepX = width / (n - 1);

    if (compareMode === 'overlay') {
      const centerY = height * 0.5;
      const scaleY = height * 0.35;

      // Draw Raw Signal (Muted Amber/Gray)
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = i * stepX;
        const y = centerY - sliceRaw[i] * scaleY;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Draw Filtered Signal (Vibrant Phosphor Green)
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = i * stepX;
        const y = centerY - sliceFiltered[i] * scaleY;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw Detected R-Peaks within window
      for (const pIdx of analysis.rPeaks) {
        if (pIdx >= startSample && pIdx < endSample) {
          const localIdx = pIdx - startSample;
          const px = localIdx * stepX;
          const py = centerY - processedSignal[pIdx] * scaleY;

          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    } else {
      // Stacked Mode: Top Half = Raw, Bottom Half = Filtered
      const halfH = height / 2;
      const scaleY = halfH * 0.35;

      // Divider line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, halfH);
      ctx.lineTo(width, halfH);
      ctx.stroke();

      // Labels
      ctx.fillStyle = '#fb923c';
      ctx.font = '10px monospace';
      ctx.fillText('RAW SIGNAL (Unfiltered)', 10, 20);

      ctx.fillStyle = '#00ff88';
      ctx.fillText('FILTERED SIGNAL (Processed + R-Peaks)', 10, halfH + 20);

      // Raw Signal on top
      const centerY1 = halfH * 0.55;
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = i * stepX;
        const y = centerY1 - sliceRaw[i] * scaleY;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Filtered on bottom
      const centerY2 = halfH + halfH * 0.55;
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = i * stepX;
        const y = centerY2 - sliceFiltered[i] * scaleY;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Markers on filtered trace
      for (const pIdx of analysis.rPeaks) {
        if (pIdx >= startSample && pIdx < endSample) {
          const localIdx = pIdx - startSample;
          const px = localIdx * stepX;
          const py = centerY2 - processedSignal[pIdx] * scaleY;

          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }, [sliceTime, sliceRaw, sliceFiltered, compareMode, analysis.rPeaks, startSample, endSample, processedSignal]);

  // Render FFT Power Spectrum onto second canvas
  useEffect(() => {
    const canvas = fftCanvasRef.current;
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

    const freqs = fftFiltered.frequencies;
    const rawPowers = fftRaw.powers;
    const filtPowers = fftFiltered.powers;

    if (!freqs.length) return;

    let maxPower = 0;
    for (let i = 0; i < freqs.length; i++) {
      if (rawPowers[i] > maxPower) maxPower = rawPowers[i];
      if (filtPowers[i] > maxPower) maxPower = filtPowers[i];
    }
    if (maxPower === 0) maxPower = 1;

    const marginL = 35;
    const marginB = 25;
    const plotW = width - marginL - 10;
    const plotH = height - marginB - 10;

    // Grid & Axis
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marginL, 10);
    ctx.lineTo(marginL, height - marginB);
    ctx.lineTo(width - 10, height - marginB);
    ctx.stroke();

    // X Axis ticks (0, 10, 20, 30, 40, 50, 60 Hz)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px monospace';
    for (let f = 0; f <= 60; f += 10) {
      const x = marginL + (f / 60) * plotW;
      ctx.fillText(`${f}Hz`, x - 10, height - 8);
    }

    // Y Axis label
    ctx.fillText('Power', 4, 15);

    // Draw Raw Spectrum (Muted Amber)
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < freqs.length; i++) {
      const x = marginL + (freqs[i] / 60) * plotW;
      const y = (height - marginB) - (rawPowers[i] / maxPower) * plotH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw Filtered Spectrum (Neon Green)
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < freqs.length; i++) {
      const x = marginL + (freqs[i] / 60) * plotW;
      const y = (height - marginB) - (filtPowers[i] / maxPower) * plotH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [fftRaw, fftFiltered]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-400" />
              <span>Biomedical Signal Processing &amp; Filter Lab</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Compare raw input against filtered output with interactive toggleable digital filters and FFT spectral analysis.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCompareMode(compareMode === 'overlay' ? 'stacked' : 'overlay')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono transition-colors"
            >
              Mode: <strong className="text-emerald-400 capitalize">{compareMode}</strong>
            </button>
          </div>
        </div>
      </div>

      {/* Main Signal Display Canvas */}
      <div className="bg-[#050811] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between text-xs font-mono px-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-orange-400">
              <span className="w-3 h-0.5 bg-orange-400" /> Raw Signal
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-3 h-1 bg-emerald-400" /> Filtered Trace
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Detected R-Peaks ({analysis.beatsCount})
            </span>
          </div>

          <span className="text-slate-400 text-[11px]">
            Window: {zoomOffsetSec.toFixed(1)}s - {(zoomOffsetSec + zoomWindowSec).toFixed(1)}s of {maxSec.toFixed(1)}s
          </span>
        </div>

        <canvas
          ref={canvasRef}
          className="w-full h-80 rounded-xl bg-slate-950/80 border border-slate-800/80 block"
          style={{ width: '100%', height: '320px' }}
        />

        {/* Timeline Slider for Zoom/Pan */}
        <div className="px-2 pt-2 flex items-center space-x-3 text-xs font-mono text-slate-400">
          <span>Pan:</span>
          <input
            type="range"
            min="0"
            max={Math.max(0, maxSec - zoomWindowSec)}
            step="0.2"
            value={zoomOffsetSec}
            onChange={(e) => setZoomOffsetSec(Number(e.target.value))}
            className="flex-1 h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoomWindowSec((prev) => Math.max(3, prev - 1))}
              className="px-2 py-0.5 bg-slate-800 rounded text-slate-300 hover:text-white"
            >
              Zoom In
            </button>
            <button
              onClick={() => setZoomWindowSec((prev) => Math.min(20, prev + 2))}
              className="px-2 py-0.5 bg-slate-800 rounded text-slate-300 hover:text-white"
            >
              Zoom Out
            </button>
          </div>
        </div>
      </div>

      {/* Filter Controls & FFT Spectrum Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Interactive Filter Lab Switches */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <Filter className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
              Interactive Filter Lab Configuration
            </h3>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {/* Baseline wander */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <div>
                <strong className="text-white block font-bold">Baseline Wander Removal</strong>
                <span className="text-[11px] text-slate-400">0.5 Hz highpass / moving average subtraction</span>
              </div>
              <input
                type="checkbox"
                checked={filterSettings.removeBaseline}
                onChange={(e) => setFilterSettings((prev) => ({ ...prev, removeBaseline: e.target.checked }))}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* 50Hz Notch */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <div>
                <strong className="text-white block font-bold">50 Hz AC Powerline Notch Filter</strong>
                <span className="text-[11px] text-slate-400">Eliminates European / Asian mains interference (Q = 10)</span>
              </div>
              <input
                type="checkbox"
                checked={filterSettings.notchFilter50Hz}
                onChange={(e) => setFilterSettings((prev) => ({ ...prev, notchFilter50Hz: e.target.checked }))}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* 60Hz Notch */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <div>
                <strong className="text-white block font-bold">60 Hz AC Powerline Notch Filter</strong>
                <span className="text-[11px] text-slate-400">Eliminates North American mains hum (Q = 10)</span>
              </div>
              <input
                type="checkbox"
                checked={filterSettings.notchFilter60Hz}
                onChange={(e) => setFilterSettings((prev) => ({ ...prev, notchFilter60Hz: e.target.checked }))}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* 40Hz Lowpass */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <div>
                <strong className="text-white block font-bold">40 Hz Lowpass Muscle Tremor Filter</strong>
                <span className="text-[11px] text-slate-400">Standard clinical monitor bandwidth, reduces EMG artifact</span>
              </div>
              <input
                type="checkbox"
                checked={filterSettings.lowpass40Hz}
                onChange={(e) => setFilterSettings((prev) => ({ ...prev, lowpass40Hz: e.target.checked }))}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* FFT Power Spectral Density (PSD) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
                Frequency Spectrum (FFT 0-60 Hz)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Peak: <strong className="text-emerald-400">{fftFiltered.peakFreq} Hz</strong>
            </span>
          </div>

          <p className="text-xs text-slate-400 font-mono">
            Displays frequency content before and after filtering. Notice how the 50/60 Hz mains peak and low-frequency baseline drift are suppressed.
          </p>

          <canvas
            ref={fftCanvasRef}
            className="w-full h-56 rounded-xl bg-slate-950/80 border border-slate-800/80 block"
            style={{ width: '100%', height: '220px' }}
          />

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
            <span className="flex items-center gap-1.5 text-orange-400">
              <span className="w-2.5 h-0.5 bg-orange-400" /> Raw FFT
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-1 bg-emerald-400" /> Filtered FFT
            </span>
            <span>Radix-2 FFT (Hann Window)</span>
          </div>
        </div>

      </div>
    </div>
  );
};
