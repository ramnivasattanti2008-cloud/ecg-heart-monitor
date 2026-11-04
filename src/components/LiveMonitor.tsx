import React, { useRef, useEffect, useState } from 'react';
import { useECG } from '../context/ECGContext';
import { 
  Play, 
  Pause, 
  Camera, 
  Sliders, 
  CheckCircle2, 
  Activity
} from 'lucide-react';
import type { RhythmType } from '../types/ecg';

export const LiveMonitor: React.FC = () => {
  const {
    isLiveRunning,
    toggleLiveRunning,
    liveRhythm,
    setLiveRhythm,
    liveBpmTarget,
    setLiveBpmTarget,
    liveCurrentBpm,
    liveMinBpm,
    liveMaxBpm,
    liveAvgBpm,
    liveBeatsCount,
    liveRRHistory,
    liveBuffer,
    displaySettings,
    setDisplaySettings,
    regenerateLiveAnalysis,
    setActiveTab,
  } = useECG();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showWaveLabels, setShowWaveLabels] = useState<boolean>(true);
  const [showRPeakMarkers, setShowRPeakMarkers] = useState<boolean>(true);
  const [snapshotTaken, setSnapshotTaken] = useState<boolean>(false);

  // Render ECG waveform onto Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Medical ECG Grid (1mm / 5mm equivalent)
    const gridSize = 25; // 5mm large box
    const smallGridSize = 5; // 1mm small box

    // Choose grid colors based on theme
    let gridMinorColor = 'rgba(16, 185, 129, 0.05)';
    let gridMajorColor = 'rgba(16, 185, 129, 0.16)';
    let traceColor = '#00ff88';

    if (displaySettings.gridTheme === 'pink') {
      gridMinorColor = 'rgba(244, 63, 94, 0.07)';
      gridMajorColor = 'rgba(244, 63, 94, 0.22)';
      traceColor = '#00f0ff';
    } else if (displaySettings.gridTheme === 'dark') {
      gridMinorColor = 'rgba(255, 255, 255, 0.03)';
      gridMajorColor = 'rgba(255, 255, 255, 0.08)';
      traceColor = '#10b981';
    }

    // Minor grid
    ctx.strokeStyle = gridMinorColor;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x < width; x += smallGridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += smallGridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Major grid
    ctx.strokeStyle = gridMajorColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Baseline center line
    const centerY = height * 0.55;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Draw Standard 1 mV Calibration Pulse at left margin (10mm high, 0.2s wide)
    const calX = 15;
    const calY = centerY;
    const calHeight = 40 * displaySettings.voltageGain; // 1 mV standard height
    const calWidth = 20;

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(calX, calY);
    ctx.lineTo(calX + 5, calY);
    ctx.lineTo(calX + 5, calY - calHeight);
    ctx.lineTo(calX + 5 + calWidth, calY - calHeight);
    ctx.lineTo(calX + 5 + calWidth, calY);
    ctx.lineTo(calX + 5 + calWidth + 10, calY);
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = '9px monospace';
    ctx.fillText('1 mV', calX + 6, calY - calHeight - 4);

    // 3. Draw ECG Signal Trace
    const buffer = liveBuffer;
    if (buffer && buffer.length > 2) {
      const startX = calX + 35;
      const availableWidth = width - startX - 10;
      const pointsCount = buffer.length;
      const stepX = availableWidth / Math.max(1, pointsCount - 1);

      // Voltage Gain factor
      const voltageScale = 45 * displaySettings.voltageGain;

      // Glow effect for phosphor trace
      ctx.shadowColor = traceColor;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = traceColor;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.beginPath();
      for (let i = 0; i < pointsCount; i++) {
        const x = startX + i * stepX;
        const y = centerY - buffer[i].amplitude * voltageScale;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Reset shadow for text and markers
      ctx.shadowBlur = 0;

      // Draw R-peak detection markers & fiducials
      if (showRPeakMarkers) {
        for (let i = 0; i < pointsCount; i++) {
          if (buffer[i].isRPeak) {
            const px = startX + i * stepX;
            const py = centerY - buffer[i].amplitude * voltageScale;

            // Highlight circle
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(px, py, 4.5, 0, Math.PI * 2);
            ctx.fill();

            // Outline
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Label
            if (showWaveLabels) {
              ctx.fillStyle = '#f87171';
              ctx.font = 'bold 10px monospace';
              ctx.fillText('R', px - 3, py - 8);
            }
          }
        }
      }

      // Sweep Beam Bar (oscilloscope wiping front)
      const lastX = startX + (pointsCount - 1) * stepX;
      ctx.fillStyle = 'rgba(0, 255, 136, 0.8)';
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 12;
      ctx.fillRect(lastX - 2, 0, 3, height);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }, [liveBuffer, displaySettings, showRPeakMarkers, showWaveLabels]);

  const handleCaptureSnapshot = () => {
    regenerateLiveAnalysis();
    setSnapshotTaken(true);
    setTimeout(() => {
      setSnapshotTaken(false);
      setActiveTab('analysis');
    }, 450);
  };

  const currentRR = liveRRHistory.length ? liveRRHistory[liveRRHistory.length - 1] : 800;

  return (
    <div className="space-y-6">
      {/* Top Monitor Header Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Channel Info & Lead Indicator */}
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-wide font-mono uppercase">
                  Lead II ECG Telemetry Monitor
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  REAL-TIME 250 Hz
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Speed: {displaySettings.paperSpeed} mm/s &bull; Gain: {displaySettings.voltageGain * 10} mm/mV &bull; Filter: 0.5-40 Hz Monitor
              </p>
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={toggleLiveRunning}
              className={`px-4 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all shadow-sm ${
                isLiveRunning
                  ? 'bg-amber-600/80 hover:bg-amber-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isLiveRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isLiveRunning ? 'Pause Monitor' : 'Resume Stream'}</span>
            </button>

            <button
              onClick={handleCaptureSnapshot}
              className="px-3.5 py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 transition-all shadow-sm"
              title="Capture current window and view in Signal Analysis"
            >
              <Camera className="w-4 h-4" />
              <span>{snapshotTaken ? 'Captured!' : 'Analyze Snapshot'}</span>
            </button>

            <button
              onClick={() => {
                setShowRPeakMarkers(!showRPeakMarkers);
              }}
              className={`px-3 py-2 rounded-lg border text-xs font-mono transition-colors ${
                showRPeakMarkers
                  ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              R-Peaks: {showRPeakMarkers ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() => setShowWaveLabels(!showWaveLabels)}
              className={`px-3 py-2 rounded-lg border text-xs font-mono transition-colors ${
                showWaveLabels
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              Labels: {showWaveLabels ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Oscilloscope Waveform Display */}
      <div className="relative rounded-2xl border-2 border-slate-800 bg-[#050811] overflow-hidden shadow-2xl">
        {/* ECG Grid & CRT Scanline Overlay */}
        <div className="scanline relative">
          <canvas
            ref={canvasRef}
            className="w-full h-80 sm:h-96 block cursor-crosshair"
            style={{ width: '100%', height: '380px' }}
          />

          {/* Monitor Screen HUD Overlays (Top Left) */}
          <div className="absolute top-4 left-4 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-300 font-mono text-xs backdrop-blur pointer-events-none">
            <div className="text-emerald-400 font-bold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              <span>LEAD II (Standard Calibration)</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Paper: {displaySettings.paperSpeed} mm/s &bull; Volt: {displaySettings.voltageGain * 10} mm/mV
            </div>
          </div>

          {/* Monitor Screen HUD Overlays (Top Right Live Telemetry Box) */}
          <div className="absolute top-4 right-4 bg-slate-950/85 border border-emerald-500/30 p-3 rounded-xl shadow-xl backdrop-blur font-mono pointer-events-none">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">HEART RATE</div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-4xl font-extrabold text-emerald-400 tracking-tight">
                {liveCurrentBpm}
              </span>
              <span className="text-xs text-emerald-500/80 font-bold">BPM</span>
            </div>
            <div className="text-[11px] text-slate-300 mt-1 flex items-center justify-between gap-3">
              <span>RR: <strong className="text-white">{currentRR}</strong> ms</span>
              <span>Beats: <strong className="text-white">{liveBeatsCount}</strong></span>
            </div>
          </div>

          {/* Bottom Left P-Q-R-S-T Annotation Guide */}
          <div className="absolute bottom-3 left-4 bg-slate-950/80 border border-slate-800/80 px-2.5 py-1 rounded-md text-[11px] font-mono text-slate-400 flex items-center gap-3 backdrop-blur pointer-events-none">
            <span className="flex items-center gap-1"><span className="text-emerald-400 font-bold">P</span> Atrial Depol</span>
            <span className="flex items-center gap-1"><span className="text-rose-400 font-bold">QRS</span> Ventricular Depol</span>
            <span className="flex items-center gap-1"><span className="text-cyan-400 font-bold">T</span> Ventricular Repol</span>
          </div>
        </div>
      </div>

      {/* Telemetry Telemetry Gauges Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Average Rate</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-white">{liveAvgBpm}</span>
            <span className="text-xs text-slate-400">BPM</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">Rolling 30 beats average</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Heart Rate Range</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-emerald-400">{liveMinBpm}</span>
            <span className="text-xs text-slate-500">-</span>
            <span className="text-xl font-bold font-mono text-rose-400">{liveMaxBpm}</span>
            <span className="text-xs text-slate-400">BPM</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">Min / Max observed</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Current RR Interval</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-cyan-400">{currentRR}</span>
            <span className="text-xs text-slate-400">ms</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">Inter-beat timing</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Signal Quality</div>
          <div className="mt-1 flex items-center gap-1.5 text-emerald-400 font-bold font-mono text-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>Optimal (98%)</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">SNR &gt; 24 dB &bull; Low drift</div>
        </div>
      </div>

      {/* Simulator Controls & Rhythm Selectors */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center space-x-2 pb-3 mb-4 border-b border-slate-800">
          <Sliders className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
            Biomedical Generator &amp; Simulator Parameters
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Rhythm Selector Buttons */}
          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-2">
              Cardiac Rhythm Preset
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'normal', label: 'Normal Sinus', desc: 'Regular P-QRS-T' },
                { id: 'bradycardia', label: 'Bradycardia', desc: '< 60 BPM Slow' },
                { id: 'tachycardia', label: 'Tachycardia', desc: '> 100 BPM Rapid' },
                { id: 'pvc', label: 'PVC Arrhythmia', desc: 'Ventricular Ectopy' },
                { id: 'afib', label: 'Atrial Fib', desc: 'Chaotic Irregular' },
                { id: 'noisy', label: 'Noisy Artifact', desc: 'EMG & Drift' },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setLiveRhythm(r.id as RhythmType)}
                  className={`text-left p-2.5 rounded-lg border text-xs font-mono transition-all ${
                    liveRhythm === r.id
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                      : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold">{r.label}</div>
                  <div className="text-[10px] text-slate-500 truncate">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Heart Rate Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-mono uppercase text-slate-300">
                Target Heart Rate
              </label>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                {liveBpmTarget} BPM
              </span>
            </div>
            <input
              type="range"
              min="40"
              max="180"
              step="1"
              value={liveBpmTarget}
              onChange={(e) => setLiveBpmTarget(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>40 (Severe Brady)</span>
              <span>75 (Normal)</span>
              <span>180 (Severe Tachy)</span>
            </div>

            {/* Quick BPM buttons */}
            <div className="flex gap-2 mt-4">
              {[50, 72, 100, 130, 160].map((bpm) => (
                <button
                  key={bpm}
                  onClick={() => setLiveBpmTarget(bpm)}
                  className={`flex-1 py-1 rounded text-[11px] font-mono border ${
                    liveBpmTarget === bpm
                      ? 'bg-emerald-500/30 border-emerald-500 text-emerald-300'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {bpm}
                </button>
              ))}
            </div>
          </div>

          {/* Monitor Calibration & Display Scales */}
          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-2">
              Physical Paper Speed &amp; Scale
            </label>
            <div className="space-y-3">
              <div>
                <span className="text-[11px] text-slate-400 font-mono block mb-1">Paper Sweep Speed:</span>
                <div className="grid grid-cols-3 gap-2">
                  {[12.5, 25, 50].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setDisplaySettings((prev) => ({ ...prev, paperSpeed: speed as 12.5 | 25 | 50 }))}
                      className={`py-1.5 rounded text-xs font-mono border ${
                        displaySettings.paperSpeed === speed
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {speed} mm/s
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 font-mono block mb-1">Voltage Amplitude Gain:</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 0.5, label: '0.5x (5mm/mV)' },
                    { val: 1.0, label: '1.0x (10mm/mV)' },
                    { val: 2.0, label: '2.0x (20mm/mV)' },
                  ].map((gain) => (
                    <button
                      key={gain.val}
                      onClick={() => setDisplaySettings((prev) => ({ ...prev, voltageGain: gain.val as 0.5 | 1 | 2 }))}
                      className={`py-1.5 rounded text-[11px] font-mono border ${
                        displaySettings.voltageGain === gain.val
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {gain.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
