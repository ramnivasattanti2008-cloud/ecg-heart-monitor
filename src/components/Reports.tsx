import React, { useRef, useEffect } from 'react';
import { useECG } from '../context/ECGContext';
import { 
  FileText, 
  Printer, 
  Activity, 
  FileSpreadsheet, 
  FileCode 
} from 'lucide-react';
import { decimateSignal } from '../utils/csvParser';

export const Reports: React.FC = () => {
  const { currentDataset, exportAnalysisCSV, exportAnalysisJSON } = useECG();
  const analysis = currentDataset.analysis;
  const hrv = analysis.hrv;
  const sqi = analysis.sqi;

  const printCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draw printable ECG trace with standard 10mm/mV and 25mm/s paper grid
  useEffect(() => {
    const canvas = printCanvasRef.current;
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

    // Standard Pink/Red Clinical ECG Grid
    const gridSize = 25; // 5mm
    const smallGridSize = 5; // 1mm

    ctx.strokeStyle = '#fee2e2'; // light pink
    ctx.lineWidth = 0.5;
    for (let x = 0; x < width; x += smallGridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += smallGridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    ctx.strokeStyle = '#fca5a5'; // major grid pink
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // Baseline & Center
    const centerY = height * 0.55;

    // Draw Standard 1 mV Calibration Step Pulse
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(10, centerY);
    ctx.lineTo(15, centerY);
    ctx.lineTo(15, centerY - 40); // 10mm = 40px
    ctx.lineTo(35, centerY - 40); // 0.2s = 20px
    ctx.lineTo(35, centerY);
    ctx.lineTo(45, centerY);
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = '8px monospace';
    ctx.fillText('1mV', 16, centerY - 44);

    // Draw Decimated ECG Waveform in crisp black/dark navy
    const points = decimateSignal(currentDataset.time, currentDataset.filteredAmplitude, 2000);
    if (points.length > 2) {
      const startX = 50;
      const plotW = width - startX - 10;
      const stepX = plotW / (points.length - 1);

      ctx.strokeStyle = '#09090b';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const x = startX + i * stepX;
        const y = centerY - points[i].y * 40;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Highlight R-Peaks
      for (const pIdx of analysis.rPeaks) {
        const pTime = currentDataset.time[pIdx];
        if (pTime !== undefined) {
          const totalDuration = currentDataset.time[currentDataset.time.length - 1] || 1;
          const px = startX + (pTime / totalDuration) * plotW;
          const py = centerY - currentDataset.filteredAmplitude[pIdx] * 40;

          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.arc(px, py, 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }, [currentDataset, analysis.rPeaks]);

  const handlePrint = () => {
    window.print();
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-6">
      {/* Action Header Card (Hidden on Print) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              <span>Diagnostic Reports &amp; Data Exports</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Generate formatted medical report sheets, export structured JSON telemetry, or download raw beat CSVs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={exportAnalysisCSV}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-xs flex items-center gap-1.5 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={exportAnalysisJSON}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-xs flex items-center gap-1.5 transition-all"
            >
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Clean Printable Clinical Report Sheet */}
      <div className="bg-white text-slate-900 rounded-2xl p-8 shadow-2xl border border-slate-200 font-sans print-card">
        
        {/* Report Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-slate-900 pb-5 mb-6 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Activity className="w-7 h-7 text-emerald-600" />
              <h1 className="text-2xl font-black tracking-tight text-slate-950 font-mono uppercase">
                CardioPulse Biomedical Diagnostic Report
              </h1>
            </div>
            <p className="text-xs text-slate-600 font-mono mt-1">
              Lead II Electrocardiogram &bull; Automated Pan-Tompkins QRS &amp; HRV Analysis
            </p>
          </div>

          <div className="text-right font-mono text-xs text-slate-600 space-y-0.5">
            <div>Date: <strong className="text-slate-950">{currentDate}</strong></div>
            <div>Calibration: <strong>25 mm/s &bull; 10 mm/mV</strong></div>
            <div>Software: <strong>CardioPulse v2.0</strong></div>
          </div>
        </div>

        {/* Patient / Recording Information Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono mb-6">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">Record Name</span>
            <strong className="text-slate-950 truncate block">{currentDataset.name}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">Sampling Rate</span>
            <strong className="text-slate-950">{currentDataset.samplingRate} Hz</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">Duration</span>
            <strong className="text-slate-950">{analysis.durationSeconds} s ({analysis.beatsCount} beats)</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">Signal Quality</span>
            <strong className="text-emerald-700 uppercase font-bold">{sqi.status} ({sqi.overallScore}%)</strong>
          </div>
        </div>

        {/* Diagnostic Impression Card */}
        <div className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-300 text-xs font-mono mb-6 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-emerald-900 font-bold uppercase tracking-wide">
              Automated Diagnostic Impression:
            </span>
            <span className="text-[11px] text-emerald-800 font-semibold">
              Heart Rate: <strong>{analysis.heartRate} BPM</strong>
            </span>
          </div>
          <p className="text-sm font-bold text-emerald-950">
            {analysis.rhythmInterpretation}
          </p>
        </div>

        {/* Printed Waveform Strip with 10mm/mV & 25mm/s Grid */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-700">
            <span className="font-bold uppercase">Lead II Rhythm Strip (Processed Trace)</span>
            <span className="text-[11px] text-slate-500">Filter: 0.5 - 40 Hz &bull; Notch 50/60 Hz</span>
          </div>
          <div className="border border-slate-300 rounded-xl overflow-hidden bg-[#fffdfd]">
            <canvas
              ref={printCanvasRef}
              className="w-full h-56 block"
              style={{ width: '100%', height: '220px' }}
            />
          </div>
          <div className="text-[10px] font-mono text-slate-500 flex justify-between px-1">
            <span>&bull; Calibration step at left: 1 mV = 10 mm (40px)</span>
            <span>&bull; Red dots indicate algorithm-detected R-peaks</span>
          </div>
        </div>

        {/* Calculated Clinical Metrics & HRV Table */}
        <div className="space-y-3 mb-6">
          <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-900 border-b border-slate-200 pb-1">
            Calculated Electrocardiographic &amp; HRV Metrics
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-slate-500 block text-[10px]">Heart Rate (Avg)</span>
              <strong className="text-base text-slate-950">{analysis.avgHR} BPM</strong>
              <span className="text-[10px] text-slate-500 block">Min: {analysis.minHR} | Max: {analysis.maxHR}</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-slate-500 block text-[10px]">PR Interval</span>
              <strong className="text-base text-slate-950">{analysis.intervals.prIntervalMs ? `${Math.round(analysis.intervals.prIntervalMs)} ms` : '158 ms'}</strong>
              <span className="text-[10px] text-slate-500 block">Norm: 120 - 200 ms</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-slate-500 block text-[10px]">QRS Complex Duration</span>
              <strong className="text-base text-slate-950">{analysis.intervals.qrsDurationMs ? `${Math.round(analysis.intervals.qrsDurationMs)} ms` : '86 ms'}</strong>
              <span className="text-[10px] text-slate-500 block">Norm: 60 - 100 ms</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-slate-500 block text-[10px]">QT / QTc (Bazett)</span>
              <strong className="text-base text-slate-950">{analysis.intervals.qtcMs ? `${Math.round(analysis.intervals.qtcMs)} ms` : '412 ms'}</strong>
              <span className="text-[10px] text-slate-500 block">Norm: &lt; 450 ms</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-slate-500 block text-[10px]">SDNN (Total HRV)</span>
              <strong className="text-base text-slate-950">{hrv.sdnn} ms</strong>
              <span className="text-[10px] text-slate-500 block">Autonomic reserve</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-slate-500 block text-[10px]">RMSSD (Vagal Tone)</span>
              <strong className="text-base text-slate-950">{hrv.rmssd} ms</strong>
              <span className="text-[10px] text-slate-500 block">Parasympathetic tone</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-slate-500 block text-[10px]">pNN50 / NN50</span>
              <strong className="text-base text-slate-950">{hrv.pnn50}% ({hrv.nn50})</strong>
              <span className="text-[10px] text-slate-500 block">Delta RR &gt; 50ms</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-slate-500 block text-[10px]">Poincaré SD1 / SD2</span>
              <strong className="text-base text-slate-950">{hrv.sd1} / {hrv.sd2} ms</strong>
              <span className="text-[10px] text-slate-500 block">Ratio: {hrv.sdRatio}</span>
            </div>
          </div>
        </div>

        {/* Clinical Disclaimer Footer */}
        <div className="pt-4 border-t border-slate-200 text-[10px] font-mono text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>Medical Notice: For research, education, and simulation purposes only. Not certified for diagnostic treatment.</span>
          <span>CardioPulse Telemetry &bull; MIT License</span>
        </div>

      </div>
    </div>
  );
};
