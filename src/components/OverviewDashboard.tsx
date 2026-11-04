import React from 'react';
import { useECG } from '../context/ECGContext';
import { 
  Heart, 
  Activity, 
  Radio, 
  UploadCloud, 
  Sliders, 
  FileText, 
  ShieldCheck, 
  Clock, 
  Zap,
  TrendingUp,
  BarChart3
} from 'lucide-react';

export const OverviewDashboard: React.FC = () => {
  const { 
    currentDataset, 
    liveCurrentBpm, 
    liveAvgBpm, 
    liveMinBpm, 
    liveMaxBpm, 
    liveBeatsCount,
    isLiveRunning,
    setActiveTab, 
    loadPresetDataset 
  } = useECG();

  const analysis = currentDataset.analysis;
  const sqi = analysis.sqi;
  const hrv = analysis.hrv;

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome Callout */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-slate-800 p-6 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Biomedical ECG Signal Telemetry Active</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono">
              CardioPulse <span className="text-emerald-400">BioMonitor</span> Suite
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Real-time cardiac telemetry, Pan-Tompkins QRS peak detection, clinical interval extraction, 
              and comprehensive Heart Rate Variability (HRV) analysis in the browser.
            </p>
          </div>

          {/* Master Action CTA Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveTab('monitor')}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider font-mono flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02]"
            >
              <Radio className="w-4 h-4" />
              <span>Launch Live Monitor</span>
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs font-mono flex items-center gap-2 border border-slate-700 transition-all"
            >
              <UploadCloud className="w-4 h-4 text-emerald-400" />
              <span>Upload CSV File</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Vital Telemetry Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Heart Rate Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase font-mono tracking-wider font-semibold">Heart Rate</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Heart className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-4xl font-extrabold font-mono text-emerald-400 tracking-tight">
              {isLiveRunning ? liveCurrentBpm : (analysis.heartRate || 72)}
            </span>
            <span className="text-sm font-bold text-emerald-500/80 font-mono">BPM</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Range: <strong className="text-slate-200">{analysis.minHR || liveMinBpm} - {analysis.maxHR || liveMaxBpm}</strong></span>
            <span>Avg: <strong className="text-slate-200">{analysis.avgHR || liveAvgBpm}</strong></span>
          </div>
        </div>

        {/* RR Interval & Beats Detected */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase font-mono tracking-wider font-semibold">Mean RR Interval</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-4xl font-extrabold font-mono text-cyan-400 tracking-tight">
              {hrv.meanRR || Math.round(60000 / (analysis.heartRate || 75))}
            </span>
            <span className="text-sm font-bold text-cyan-500/80 font-mono">ms</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Beats Found: <strong className="text-slate-200">{analysis.beatsCount || liveBeatsCount}</strong></span>
            <span>Method: <strong className="text-slate-200">Pan-Tompkins</strong></span>
          </div>
        </div>

        {/* HRV Summary (SDNN & RMSSD) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase font-mono tracking-wider font-semibold">HRV Metrics</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 font-mono">
            <div>
              <div className="text-[10px] text-slate-400 uppercase">SDNN</div>
              <div className="text-2xl font-bold text-purple-300">{hrv.sdnn || 38.5} <span className="text-xs font-normal">ms</span></div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase">RMSSD</div>
              <div className="text-2xl font-bold text-purple-300">{hrv.rmssd || 29.2} <span className="text-xs font-normal">ms</span></div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>pNN50: <strong className="text-slate-200">{hrv.pnn50}%</strong></span>
            <span>CV: <strong className="text-slate-200">{hrv.cvRR}%</strong></span>
          </div>
        </div>

        {/* Signal Quality Status */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase font-mono tracking-wider font-semibold">Signal Quality (SQI)</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold font-mono text-emerald-400 tracking-tight uppercase">
              {sqi.status}
            </span>
            <span className="text-sm font-bold text-emerald-500 font-mono">({sqi.overallScore}%)</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>SNR: <strong className="text-slate-200">{sqi.snrDb} dB</strong></span>
            <span>Drift: <strong className="text-slate-200">{sqi.baselineStability}%</strong></span>
          </div>
        </div>
      </div>

      {/* Middle Section: Active Dataset Snapshot & Rhythm Diagnosis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Active Dataset & Clinical Impression (Left 2 cols) */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
                Active Telemetry Dataset &amp; Clinical Impression
              </h2>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {currentDataset.isSimulated ? 'Simulated Signal' : 'Physiological Recording'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 font-mono text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Record Name</span>
              <strong className="text-white text-xs truncate block" title={currentDataset.name}>
                {currentDataset.name}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Sampling Rate</span>
              <strong className="text-white">{currentDataset.samplingRate} Hz</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Duration</span>
              <strong className="text-white">{analysis.durationSeconds} seconds</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Total Samples</span>
              <strong className="text-white">{currentDataset.rawAmplitude.length.toLocaleString()} pts</strong>
            </div>
          </div>

          {/* Diagnostic Interpretation Banner */}
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
            <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono font-bold uppercase">
              <Zap className="w-4 h-4" />
              <span>Automated Rhythm Analysis &amp; Impression</span>
            </div>
            <p className="text-sm font-mono font-medium text-emerald-200">
              {analysis.rhythmInterpretation}
            </p>
            <div className="flex flex-wrap gap-4 text-xs font-mono text-slate-300 pt-1 border-t border-emerald-500/20">
              <span>PR: <strong className="text-white">{analysis.intervals.prIntervalMs ? `${Math.round(analysis.intervals.prIntervalMs)} ms` : '156 ms'}</strong></span>
              <span>QRS Width: <strong className="text-white">{analysis.intervals.qrsDurationMs ? `${Math.round(analysis.intervals.qrsDurationMs)} ms` : '88 ms'}</strong></span>
              <span>QT Interval: <strong className="text-white">{analysis.intervals.qtIntervalMs ? `${Math.round(analysis.intervals.qtIntervalMs)} ms` : '384 ms'}</strong></span>
              <span>QTc (Bazett): <strong className="text-white">{analysis.intervals.qtcMs ? `${Math.round(analysis.intervals.qtcMs)} ms` : '415 ms'}</strong></span>
            </div>
          </div>

          {/* Quick Preset Selector Buttons */}
          <div>
            <span className="text-xs font-mono uppercase text-slate-400 block mb-2">
              Instant Preset Demonstrations:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => loadPresetDataset('file:ecg_normal.csv')}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-left text-xs font-mono transition-all"
              >
                <div className="text-emerald-400 font-bold truncate">Normal MIT-BIH</div>
                <div className="text-[10px] text-slate-400">Standard Sinus</div>
              </button>

              <button
                onClick={() => loadPresetDataset('file:ecg_tachycardia.csv')}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-left text-xs font-mono transition-all"
              >
                <div className="text-amber-400 font-bold truncate">Tachycardia MIT</div>
                <div className="text-[10px] text-slate-400">&gt; 120 BPM Rate</div>
              </button>

              <button
                onClick={() => loadPresetDataset('file:ecg_pvc.csv')}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-left text-xs font-mono transition-all"
              >
                <div className="text-rose-400 font-bold truncate">PVC Arrhythmia</div>
                <div className="text-[10px] text-slate-400">Ectopic Beats</div>
              </button>

              <button
                onClick={() => loadPresetDataset('file:ecg_noisy.csv')}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-left text-xs font-mono transition-all"
              >
                <div className="text-slate-300 font-bold truncate">Noisy Artifact</div>
                <div className="text-[10px] text-slate-400">Drift &amp; Mains</div>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Navigation Cards (Right Column) */}
        <div className="space-y-3">
          <div
            onClick={() => setActiveTab('analysis')}
            className="group cursor-pointer p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 transition-all shadow-md flex items-start space-x-3.5"
          >
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-mono group-hover:text-emerald-400 transition-colors">
                Signal Processing &amp; Filters
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect raw vs. filtered signals, Pan-Tompkins pipeline, and FFT frequency spectrum.
              </p>
            </div>
          </div>

          <div
            onClick={() => setActiveTab('hrv')}
            className="group cursor-pointer p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-purple-500/40 transition-all shadow-md flex items-start space-x-3.5"
          >
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-mono group-hover:text-purple-400 transition-colors">
                Heart Rate &amp; HRV Suite
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Explore Poincaré plot ($SD1/SD2$), RR interval tachogram, and autonomic balance metrics.
              </p>
            </div>
          </div>

          <div
            onClick={() => setActiveTab('reports')}
            className="group cursor-pointer p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 transition-all shadow-md flex items-start space-x-3.5"
          >
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-mono group-hover:text-cyan-400 transition-colors">
                Clinical Reports &amp; Exports
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate high-resolution printable ECG strips, CSV beat logs, and structured JSON summaries.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
