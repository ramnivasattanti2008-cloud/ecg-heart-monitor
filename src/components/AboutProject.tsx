import React from 'react';
import { 
  Info, 
  Activity, 
  ExternalLink, 
  ShieldAlert, 
  HeartHandshake, 
  Cpu
} from 'lucide-react';

export const AboutProject: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <Info className="w-5 h-5 text-emerald-400" />
              <span>About CardioPulse BioMonitor &amp; Scientific Methodology</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Architecture, digital signal processing algorithms, mathematical derivations, and open-source attribution.
            </p>
          </div>
          <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Open Source &bull; MIT License
          </span>
        </div>
      </div>

      {/* Grid: Signal Processing Architecture & Pan-Tompkins Algorithm */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Pan-Tompkins Pipeline Detailed Breakdown */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
              Pan-Tompkins QRS Detection Pipeline
            </h3>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
              <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-bold">1</span>
                <span>Bandpass Filter (5 &ndash; 15 Hz)</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Cascaded 2nd-order Butterworth/biquad highpass (5 Hz) and lowpass (15 Hz) to isolate QRS energy while rejecting baseline wander (&lt; 0.5 Hz), P/T waves, and 50/60 Hz mains interference.
              </p>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
              <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-bold">2</span>
                <span>Five-Point Derivative Operator</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Differentiates the bandpassed signal: <code className="text-emerald-300">y[n] = (1/8T) * (2x[n] + x[n-1] - x[n-3] - 2x[n-4])</code>, accentuating the steep slope of ventricular depolarization.
              </p>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
              <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-bold">3</span>
                <span>Non-Linear Squaring</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Pointwise squaring <code className="text-emerald-300">y[n] = x[n]^2</code> makes all values positive and non-linearly amplifies high-frequency QRS complexes over lower amplitude noise.
              </p>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
              <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-bold">4</span>
                <span>Moving-Window Integration (~150 ms)</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Sliding integration window extracts waveform envelope and pulse duration, yielding a smooth energy wave corresponding to each cardiac contraction.
              </p>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
              <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-bold">5</span>
                <span>Dual-Threshold Search-Back &amp; Refinement</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Adaptive thresholds (<code className="text-slate-200">SPKI</code>, <code className="text-slate-200">NPKI</code>) adapt to changing amplitudes. If a beat is overdue (&gt; 1.66 * RR_mean), search-back accepts subthreshold peaks. Detected fiducials are refined to true R-peaks on the baseline-subtracted raw signal.
              </p>
            </div>
          </div>
        </div>

        {/* Mathematical Formulas & HRV Theory */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <Cpu className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
              Heart Rate Variability (HRV) Formulations
            </h3>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
              <span className="text-purple-400 font-bold block">Heart Rate (BPM)</span>
              <p className="text-slate-300">
                Calculated from adjacent R-peak intervals: <code className="text-emerald-300">BPM = 60,000 / RR (ms)</code>
              </p>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
              <span className="text-purple-400 font-bold block">SDNN (Standard Deviation of NN Intervals)</span>
              <p className="text-slate-300">
                <code className="text-purple-300">SDNN = sqrt( (1 / (N - 1)) * sum( (RR_i - Mean_RR)^2 ) )</code>
              </p>
              <p className="text-slate-500 text-[10px]">Reflects total cyclic autonomic variability and cardiac reserve.</p>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
              <span className="text-purple-400 font-bold block">RMSSD (Root Mean Square of Successive Differences)</span>
              <p className="text-slate-300">
                <code className="text-purple-300">RMSSD = sqrt( (1 / (N - 1)) * sum( (RR_i+1 - RR_i)^2 ) )</code>
              </p>
              <p className="text-slate-500 text-[10px]">Primary clinical indicator of parasympathetic vagal activity.</p>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
              <span className="text-purple-400 font-bold block">Poincaré Plot Indices (SD1 &amp; SD2)</span>
              <p className="text-slate-300">
                <code className="text-cyan-300">SD1 = sqrt( 0.5 * RMSSD^2 )</code> &bull; <code className="text-cyan-300">SD2 = sqrt( 2*SDNN^2 - 0.5*RMSSD^2 )</code>
              </p>
              <p className="text-slate-500 text-[10px]">SD1 measures beat-to-beat variability; SD2 measures long-term continuous variability.</p>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
              <span className="text-purple-400 font-bold block">Bazett Rate-Corrected QT Interval (QTc)</span>
              <p className="text-slate-300">
                <code className="text-amber-300">QTc = QT (ms) / sqrt( RR in seconds )</code>
              </p>
              <p className="text-slate-500 text-[10px]">Normalizes ventricular repolarization duration against fluctuating heart rate.</p>
            </div>
          </div>
        </div>

      </div>

      {/* Attribution & Open Source License Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          <HeartHandshake className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
            Attribution &amp; Open-Source Compliance
          </h3>
        </div>

        <div className="space-y-3 text-xs font-mono text-slate-300">
          <p className="leading-relaxed">
            This project is developed with reference to the open-source <strong className="text-white">Biomedical Signal Toolkit</strong> by Vittorio Berardocco, licensed under the MIT License.
          </p>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-emerald-400 font-bold">Reference Repository:</span>
              <a 
                href="https://github.com/vberardocco/biomedical-signal-toolkit" 
                target="_blank" 
                rel="noreferrer"
                className="text-emerald-400 hover:underline flex items-center gap-1 text-[11px]"
              >
                <span>github.com/vberardocco/biomedical-signal-toolkit</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <p className="text-slate-400 text-[11px]">
              Original work Copyright &copy; 2024 Vittorio Berardocco. Licensed under the MIT License.
              We gratefully acknowledge their algorithmic reference for browser-based biomedical signal analysis.
            </p>
          </div>

          <p className="text-slate-400 text-[11px] leading-relaxed">
            Our implementation provides a completely rewritten modern architecture built in React, TypeScript, and Tailwind CSS with real-time 60fps Canvas oscilloscope telemetry, Web Audio heart tone synthesis, interactive Filter Lab, Poincaré phase-space geometry, and printable clinical report generation.
          </p>
        </div>
      </div>

      {/* Mandatory Medical Disclaimer */}
      <div className="bg-amber-950/30 border-2 border-amber-900/60 rounded-2xl p-6 shadow-lg space-y-3">
        <div className="flex items-center space-x-2 text-amber-400">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <h3 className="text-sm font-bold uppercase font-mono tracking-wider">
            Medical &amp; Clinical Safety Disclaimer
          </h3>
        </div>
        <p className="text-xs text-amber-200/90 font-mono leading-relaxed">
          CardioPulse BioMonitor is an educational, research, and engineering software simulator. It is not a certified medical device (FDA, CE, or equivalent). 
          The waveforms, algorithms, detected peaks, and calculated values must <strong>not</strong> be used for actual clinical diagnosis, medical triage, or patient treatment decisions. 
          Always consult a licensed medical professional for clinical electrocardiogram interpretations.
        </p>
      </div>
    </div>
  );
};
