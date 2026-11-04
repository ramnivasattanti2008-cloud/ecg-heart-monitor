import React, { useRef, useEffect } from 'react';
import { useECG } from '../context/ECGContext';
import { 
  HeartPulse, 
  TrendingUp, 
  Info, 
  BarChart2, 
  Compass
} from 'lucide-react';

export const HeartRateHRV: React.FC = () => {
  const { currentDataset } = useECG();
  const analysis = currentDataset.analysis;
  const hrv = analysis.hrv;
  const rrIntervals = analysis.rrIntervals;

  const tachogramCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const poincareCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const histCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Draw RR Interval Tachogram
  useEffect(() => {
    const canvas = tachogramCanvasRef.current;
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

    if (rrIntervals.length < 2) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px monospace';
      ctx.fillText('Insufficient beats detected for tachogram plotting', 20, height / 2);
      return;
    }

    const marginL = 45;
    const marginB = 30;
    const plotW = width - marginL - 15;
    const plotH = height - marginB - 15;

    let minRR = Math.min(...rrIntervals) * 0.9;
    let maxRR = Math.max(...rrIntervals) * 1.1;
    if (maxRR - minRR < 100) { minRR -= 50; maxRR += 50; }

    // Grid & Axes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marginL, 10);
    ctx.lineTo(marginL, height - marginB);
    ctx.lineTo(width - 10, height - marginB);
    ctx.stroke();

    // Y Axis Ticks (ms)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px monospace';
    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const val = minRR + (i / ySteps) * (maxRR - minRR);
      const y = (height - marginB) - (i / ySteps) * plotH;
      ctx.fillText(`${Math.round(val)}ms`, 5, y + 3);
      ctx.beginPath();
      ctx.moveTo(marginL, y);
      ctx.lineTo(width - 10, y);
      ctx.stroke();
    }

    // X Axis Ticks (Beat #)
    const n = rrIntervals.length;
    for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 6))) {
      const x = marginL + (i / (n - 1)) * plotW;
      ctx.fillText(`#${i + 1}`, x - 5, height - 10);
    }

    // Draw Tachogram Line & Points
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = marginL + (i / (n - 1)) * plotW;
      const y = (height - marginB) - ((rrIntervals[i] - minRR) / (maxRR - minRR)) * plotH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Plot Points
    ctx.fillStyle = '#0284c7';
    for (let i = 0; i < n; i++) {
      const x = marginL + (i / (n - 1)) * plotW;
      const y = (height - marginB) - ((rrIntervals[i] - minRR) / (maxRR - minRR)) * plotH;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [rrIntervals]);

  // 2. Draw Poincaré Plot (RR_n vs RR_n+1)
  useEffect(() => {
    const canvas = poincareCanvasRef.current;
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

    if (rrIntervals.length < 3) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px monospace';
      ctx.fillText('Need at least 3 beats for Poincaré scatter plot', 20, height / 2);
      return;
    }

    const margin = 40;
    const plotSize = Math.min(width, height) - margin * 2;
    const originX = margin;
    const originY = height - margin;

    let minRR = Math.min(...rrIntervals) * 0.9;
    let maxRR = Math.max(...rrIntervals) * 1.1;
    if (maxRR - minRR < 120) { minRR -= 60; maxRR += 60; }

    // Line of Identity (diagonal y = x)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX + plotSize, originY - plotSize);
    ctx.stroke();
    ctx.setLineDash([]);

    // Axes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX + plotSize, originY);
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX, originY - plotSize);
    ctx.stroke();

    // Axis Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText('RR_n (ms)', originX + plotSize / 2 - 20, height - 10);
    ctx.save();
    ctx.translate(12, originY - plotSize / 2 + 20);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('RR_n+1 (ms)', 0, 0);
    ctx.restore();

    // Plot Points (RR[i], RR[i+1])
    ctx.fillStyle = '#a855f7';
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 4;
    for (let i = 0; i < rrIntervals.length - 1; i++) {
      const r1 = rrIntervals[i];
      const r2 = rrIntervals[i + 1];
      const x = originX + ((r1 - minRR) / (maxRR - minRR)) * plotSize;
      const y = originY - ((r2 - minRR) / (maxRR - minRR)) * plotSize;

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Draw Poincaré Fitted Ellipse (Center = (meanRR, meanRR), Axes = SD1, SD2)
    const meanRR = hrv.meanRR || ((minRR + maxRR) / 2);
    const sd1 = hrv.sd1 || 20;
    const sd2 = hrv.sd2 || 40;

    const cx = originX + ((meanRR - minRR) / (maxRR - minRR)) * plotSize;
    const cy = originY - ((meanRR - minRR) / (maxRR - minRR)) * plotSize;
    const rx = (sd2 / (maxRR - minRR)) * plotSize * 1.5;
    const ry = (sd1 / (maxRR - minRR)) * plotSize * 1.5;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 4); // 45 degrees along line of identity
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(10, rx), Math.max(5, ry), 0, 0, Math.PI * 2);
    ctx.stroke();

    // Center Crosshair
    ctx.strokeStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(-5, 0); ctx.lineTo(5, 0);
    ctx.moveTo(0, -5); ctx.lineTo(0, 5);
    ctx.stroke();
    ctx.restore();
  }, [rrIntervals, hrv]);

  // 3. Draw RR Interval Distribution Histogram
  useEffect(() => {
    const canvas = histCanvasRef.current;
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

    if (rrIntervals.length < 3) return;

    const numBins = 10;
    const minRR = Math.min(...rrIntervals);
    const maxRR = Math.max(...rrIntervals);
    const binWidth = (maxRR - minRR) / numBins || 10;

    const bins = new Array(numBins).fill(0);
    for (const rr of rrIntervals) {
      const idx = Math.min(numBins - 1, Math.max(0, Math.floor((rr - minRR) / binWidth)));
      bins[idx]++;
    }

    const maxBinCount = Math.max(...bins, 1);
    const marginL = 35;
    const marginB = 25;
    const plotW = width - marginL - 15;
    const plotH = height - marginB - 15;
    const barW = (plotW / numBins) - 3;

    // Draw Bars
    ctx.fillStyle = '#06b6d4';
    for (let i = 0; i < numBins; i++) {
      const x = marginL + i * (plotW / numBins) + 1.5;
      const bH = (bins[i] / maxBinCount) * plotH;
      const y = (height - marginB) - bH;

      ctx.fillRect(x, y, barW, bH);

      // Label below bar
      if (i % 2 === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '8px monospace';
        const binCenter = Math.round(minRR + (i + 0.5) * binWidth);
        ctx.fillText(`${binCenter}ms`, x, height - 8);
        ctx.fillStyle = '#06b6d4';
      }
    }
  }, [rrIntervals]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-emerald-400" />
              <span>Heart Rate &amp; Heart Rate Variability (HRV) Suite</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Time-domain (SDNN, RMSSD, pNN50), Poincaré geometric dynamics (SD1/SD2), and frequency-domain autonomic estimates.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-300 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
            Beats Analyzed: <strong className="text-emerald-400">{analysis.beatsCount}</strong>
          </div>
        </div>
      </div>

      {/* Main Plots Grid: Tachogram & Poincaré Plot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Tachogram Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                Beat-to-Beat RR Interval Tachogram
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Time-Domain Series</span>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            Displays succession of RR interval timings (ms) across detected beats.
          </p>
          <canvas
            ref={tachogramCanvasRef}
            className="w-full h-64 rounded-xl bg-slate-950/80 border border-slate-800/80 block"
            style={{ width: '100%', height: '240px' }}
          />
        </div>

        {/* Poincaré Scatter Plot */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <Compass className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                Poincaré Phase-Space Plot (RR_n vs RR_n+1)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              SD1: <strong className="text-emerald-400">{hrv.sd1}ms</strong> &bull; SD2: <strong className="text-purple-400">{hrv.sd2}ms</strong>
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            Non-linear phase space: ellipse width (SD1) reflects fast parasympathetic vagal modulation; length (SD2) reflects overall autonomic tone.
          </p>
          <canvas
            ref={poincareCanvasRef}
            className="w-full h-64 rounded-xl bg-slate-950/80 border border-slate-800/80 block"
            style={{ width: '100%', height: '240px' }}
          />
        </div>

      </div>

      {/* Secondary Row: RR Distribution Histogram & Clinical Interpretation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* RR Histogram */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
            <BarChart2 className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
              RR Interval Histogram
            </h3>
          </div>
          <canvas
            ref={histCanvasRef}
            className="w-full h-44 rounded-xl bg-slate-950/80 border border-slate-800/80 block"
            style={{ width: '100%', height: '170px' }}
          />
          <div className="text-[11px] font-mono text-slate-400 flex justify-between">
            <span>Min: {hrv.minRR} ms</span>
            <span>Mean: {hrv.meanRR} ms</span>
            <span>Max: {hrv.maxRR} ms</span>
          </div>
        </div>

        {/* Clinical Reference Standards & Normative Ranges Table (2 Columns) */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                Comprehensive HRV Metrics &amp; Clinical Ranges
              </h3>
            </div>
            <span className="text-[10px] text-slate-500">Task Force of ESC / NASPE Standards</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 text-[11px]">
                  <th className="p-2.5 border border-slate-800">Metric</th>
                  <th className="p-2.5 border border-slate-800">Calculated Value</th>
                  <th className="p-2.5 border border-slate-800">Clinical Normal Range</th>
                  <th className="p-2.5 border border-slate-800">Physiological Significance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="p-2.5 font-bold text-white">Mean RR</td>
                  <td className="p-2.5 text-cyan-400 font-bold">{hrv.meanRR} ms</td>
                  <td className="p-2.5 text-slate-400">600 &ndash; 1200 ms</td>
                  <td className="p-2.5 text-slate-400">Average interval between adjacent normal heartbeats</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-white">SDNN</td>
                  <td className="p-2.5 text-purple-400 font-bold">{hrv.sdnn} ms</td>
                  <td className="p-2.5 text-slate-400">30 &ndash; 100 ms (short-term)</td>
                  <td className="p-2.5 text-slate-400">Gold standard for overall autonomic nervous system reserve</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-white">RMSSD</td>
                  <td className="p-2.5 text-emerald-400 font-bold">{hrv.rmssd} ms</td>
                  <td className="p-2.5 text-slate-400">20 &ndash; 80 ms</td>
                  <td className="p-2.5 text-slate-400">Primary index of parasympathetic (vagal) tone</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-white">pNN50</td>
                  <td className="p-2.5 text-amber-400 font-bold">{hrv.pnn50}%</td>
                  <td className="p-2.5 text-slate-400">&gt; 3.0%</td>
                  <td className="p-2.5 text-slate-400">Percentage of successive differences exceeding 50ms</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-white">Poincaré SD1 / SD2</td>
                  <td className="p-2.5 text-indigo-400 font-bold">{hrv.sdRatio}</td>
                  <td className="p-2.5 text-slate-400">0.3 &ndash; 0.7</td>
                  <td className="p-2.5 text-slate-400">Balance between short-term and long-term HRV variability</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-white">LF / HF Ratio</td>
                  <td className="p-2.5 text-rose-400 font-bold">{hrv.lfHfRatio}</td>
                  <td className="p-2.5 text-slate-400">1.0 &ndash; 2.5</td>
                  <td className="p-2.5 text-slate-400">Sympathovagal balance proxy index</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-white">Spectral Power (LF / HF)</td>
                  <td className="p-2.5 text-cyan-400 font-bold">{hrv.lfPower ?? '—'} / {hrv.hfPower ?? '—'} ms²</td>
                  <td className="p-2.5 text-slate-400">LF: 0.04-0.15Hz, HF: 0.15-0.40Hz</td>
                  <td className="p-2.5 text-slate-400">Absolute Welch periodogram spectral power</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-white">Normalized Units (nuLF / nuHF)</td>
                  <td className="p-2.5 text-amber-400 font-bold">{hrv.nuLF ?? 50}% / {hrv.nuHF ?? 50}%</td>
                  <td className="p-2.5 text-slate-400">nuLF: 40-70%, nuHF: 30-60%</td>
                  <td className="p-2.5 text-slate-400">Relative autonomic sympathetic/parasympathetic contribution</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-white">Sample Entropy (SampEn)</td>
                  <td className="p-2.5 text-emerald-400 font-bold">{hrv.sampleEntropy ?? '—'}</td>
                  <td className="p-2.5 text-slate-400">1.0 &ndash; 2.2</td>
                  <td className="p-2.5 text-slate-400">Nonlinear complexity and regularity of heart rate dynamics</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
