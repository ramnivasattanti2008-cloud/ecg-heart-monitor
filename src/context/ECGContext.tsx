// Global ECG State Management & Telemetry Context

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { 
  ECGDataset, 
  ECGAnalysisResult, 
  RhythmType, 
  FilterSettings, 
  MonitorDisplaySettings 
} from '../types/ecg';
import { generateSyntheticECG, LiveECGStreamer } from '../utils/ecgSimulator';
import { analyzeECGSignal, parseECGFile } from '../utils/csvParser';
import { heartAudio } from '../utils/audioBeep';

export type NavTab = 'overview' | 'monitor' | 'upload' | 'analysis' | 'hrv' | 'reports' | 'about';

interface ECGContextType {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  currentDataset: ECGDataset;
  setCurrentDataset: (ds: ECGDataset) => void;
  // Live Monitor Stream State
  isLiveRunning: boolean;
  toggleLiveRunning: () => void;
  liveRhythm: RhythmType;
  setLiveRhythm: (rhythm: RhythmType) => void;
  liveBpmTarget: number;
  setLiveBpmTarget: (bpm: number) => void;
  liveCurrentBpm: number;
  liveMinBpm: number;
  liveMaxBpm: number;
  liveAvgBpm: number;
  liveBeatsCount: number;
  liveRRHistory: number[];
  liveBuffer: { time: number; amplitude: number; isRPeak: boolean }[];
  // Display & Filters
  filterSettings: FilterSettings;
  setFilterSettings: React.Dispatch<React.SetStateAction<FilterSettings>>;
  displaySettings: MonitorDisplaySettings;
  setDisplaySettings: React.Dispatch<React.SetStateAction<MonitorDisplaySettings>>;
  // Actions
  loadPresetDataset: (presetKey: string) => Promise<void>;
  loadUploadedData: (text: string, filename: string, fs?: number, timeCol?: number, ampCol?: number) => void;
  regenerateLiveAnalysis: () => ECGAnalysisResult;
  exportAnalysisJSON: () => void;
  exportAnalysisCSV: () => void;
}

const defaultFilterSettings: FilterSettings = {
  removeBaseline: true,
  notchFilter50Hz: true,
  notchFilter60Hz: false,
  lowpass40Hz: true,
  panTompkinsBandpass: true,
};

const defaultDisplaySettings: MonitorDisplaySettings = {
  paperSpeed: 25,
  voltageGain: 1,
  gridTheme: 'green',
  showPeaks: true,
  showWaves: true,
  sweepMode: 'oscilloscope',
  soundEnabled: false,
};

const ECGContext = createContext<ECGContextType | undefined>(undefined);

export const ECGProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');

  // Initialize with a high-fidelity synthetic ECG
  const [currentDataset, setCurrentDataset] = useState<ECGDataset>(() => {
    const synth = generateSyntheticECG('normal', 15, 250, 72);
    return analyzeECGSignal('Simulated Normal Sinus Rhythm (Adult)', synth.time, synth.amplitude, synth.fs, true, 'normal');
  });

  const [filterSettings, setFilterSettings] = useState<FilterSettings>(defaultFilterSettings);
  const [displaySettings, setDisplaySettings] = useState<MonitorDisplaySettings>(defaultDisplaySettings);

  // Live streaming states
  const [isLiveRunning, setIsLiveRunning] = useState<boolean>(true);
  const [liveRhythm, setLiveRhythm] = useState<RhythmType>('normal');
  const [liveBpmTarget, setLiveBpmTarget] = useState<number>(75);
  const [liveCurrentBpm, setLiveCurrentBpm] = useState<number>(75);
  const [liveMinBpm, setLiveMinBpm] = useState<number>(72);
  const [liveMaxBpm, setLiveMaxBpm] = useState<number>(78);
  const [liveAvgBpm, setLiveAvgBpm] = useState<number>(75);
  const [liveBeatsCount, setLiveBeatsCount] = useState<number>(0);
  const [liveRRHistory, setLiveRRHistory] = useState<number[]>([]);
  const [liveBuffer, setLiveBuffer] = useState<{ time: number; amplitude: number; isRPeak: boolean }[]>([]);

  const streamerRef = useRef<LiveECGStreamer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastBeatTimeRef = useRef<number>(0);
  const liveRRsRef = useRef<number[]>([]);
  const beatsCounterRef = useRef<number>(0);
  const bpmsRef = useRef<number[]>([]);

  // Initialize or update streamer
  useEffect(() => {
    if (!streamerRef.current) {
      streamerRef.current = new LiveECGStreamer(250, liveRhythm, liveBpmTarget);
    } else {
      streamerRef.current.setRhythm(liveRhythm);
      streamerRef.current.setBpm(liveBpmTarget);
    }
  }, [liveRhythm, liveBpmTarget]);

  // Handle sound mute setting sync
  useEffect(() => {
    heartAudio.setMuted(!displaySettings.soundEnabled);
  }, [displaySettings.soundEnabled]);

  // Real-time animation loop (60fps continuous telemetry stream)
  useEffect(() => {
    if (!isLiveRunning) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const streamer = streamerRef.current;
    if (!streamer) return;

    let lastTimestamp = performance.now();
    const targetFps = 60;
    const intervalMs = 1000 / targetFps;
    const samplesPerSecond = 250;
    const maxBufferPoints = 1250; // 5 seconds window at 250Hz

    const tick = (now: number) => {
      const elapsed = now - lastTimestamp;
      if (elapsed >= intervalMs) {
        const samplesToGenerate = Math.max(1, Math.min(10, Math.round((elapsed / 1000) * samplesPerSecond)));
        lastTimestamp = now;

        const newSamples: { time: number; amplitude: number; isRPeak: boolean }[] = [];

        for (let s = 0; s < samplesToGenerate; s++) {
          const sample = streamer.nextSample();

          // Apply current interactive filters on live stream
          const amp = sample.amplitude;

          if (sample.isRPeak) {
            beatsCounterRef.current += 1;
            setLiveBeatsCount(beatsCounterRef.current);

            // Calculate instantaneous RR interval and BPM
            const beatTime = sample.time;
            if (lastBeatTimeRef.current > 0) {
              const rrMs = (beatTime - lastBeatTimeRef.current) * 1000;
              if (rrMs >= 250 && rrMs <= 2000) {
                const bpm = Math.round(60000 / rrMs);
                liveRRsRef.current.push(Number(rrMs.toFixed(1)));
                if (liveRRsRef.current.length > 50) liveRRsRef.current.shift();

                bpmsRef.current.push(bpm);
                if (bpmsRef.current.length > 30) bpmsRef.current.shift();

                const avg = Math.round(bpmsRef.current.reduce((a, b) => a + b, 0) / bpmsRef.current.length);
                const min = Math.min(...bpmsRef.current);
                const max = Math.max(...bpmsRef.current);

                setLiveCurrentBpm(bpm);
                setLiveAvgBpm(avg);
                setLiveMinBpm(min);
                setLiveMaxBpm(max);
                setLiveRRHistory([...liveRRsRef.current]);
              }
            }
            lastBeatTimeRef.current = beatTime;

            // Trigger monitor audio beep if sound is enabled
            if (displaySettings.soundEnabled) {
              heartAudio.playHeartBeep(880);
            }
          }

          newSamples.push({
            time: sample.time,
            amplitude: amp,
            isRPeak: sample.isRPeak,
          });
        }

        setLiveBuffer((prev) => {
          const updated = [...prev, ...newSamples];
          if (updated.length > maxBufferPoints) {
            return updated.slice(updated.length - maxBufferPoints);
          }
          return updated;
        });
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isLiveRunning, filterSettings, displaySettings.soundEnabled, liveRhythm]);

  const toggleLiveRunning = useCallback(() => {
    setIsLiveRunning((prev) => !prev);
  }, []);

  // Preset loader
  const loadPresetDataset = useCallback(async (presetKey: string) => {
    try {
      if (presetKey.startsWith('file:')) {
        const filename = presetKey.replace('file:', '');
        const response = await fetch(`./samples/${filename}`);
        if (!response.ok) {
          throw new Error(`Failed to load ${filename} (${response.statusText})`);
        }
        const text = await response.text();
        const parsed = parseECGFile(text, 360); // MIT-BIH is usually 360Hz
        let cleanName = 'MIT-BIH Dataset';
        let rhythm: RhythmType = 'normal';
        if (filename.includes('normal')) {
          cleanName = 'MIT-BIH Normal Sinus Rhythm (PhysioNet)';
          rhythm = 'normal';
        } else if (filename.includes('tachycardia')) {
          cleanName = 'MIT-BIH Sinus Tachycardia (PhysioNet)';
          rhythm = 'tachycardia';
        } else if (filename.includes('pvc')) {
          cleanName = 'MIT-BIH Premature Ventricular Contractions (PVC)';
          rhythm = 'pvc';
        } else if (filename.includes('noisy')) {
          cleanName = 'MIT-BIH High-Noise Recording with Motion Artifact';
          rhythm = 'noisy';
        }

        const analyzed = analyzeECGSignal(cleanName, parsed.time, parsed.amplitude, parsed.fs, false, rhythm);
        setCurrentDataset(analyzed);
        setLiveRhythm(rhythm);
        setLiveBpmTarget(analyzed.analysis.heartRate || 75);
      } else {
        // Synthetic generator presets
        let rhythm: RhythmType = 'normal';
        let name = 'Simulated Normal Sinus Rhythm (Adult 72 BPM)';
        let targetBpm = 72;

        if (presetKey === 'synth_bradycardia') {
          rhythm = 'bradycardia';
          name = 'Simulated Sinus Bradycardia (Athlete 50 BPM)';
          targetBpm = 50;
        } else if (presetKey === 'synth_tachycardia') {
          rhythm = 'tachycardia';
          name = 'Simulated Sinus Tachycardia (Exertion 130 BPM)';
          targetBpm = 130;
        } else if (presetKey === 'synth_pvc') {
          rhythm = 'pvc';
          name = 'Simulated Ventricular Ectopy (Frequent PVCs)';
          targetBpm = 74;
        } else if (presetKey === 'synth_afib') {
          rhythm = 'afib';
          name = 'Simulated Atrial Fibrillation (Irregular RR, No P Wave)';
          targetBpm = 95;
        } else if (presetKey === 'synth_noisy') {
          rhythm = 'noisy';
          name = 'Simulated Noisy ECG (50Hz Mains + Baseline Drift)';
          targetBpm = 75;
        }

        const synth = generateSyntheticECG(rhythm, 20, 250, targetBpm);
        const analyzed = analyzeECGSignal(name, synth.time, synth.amplitude, synth.fs, true, rhythm);
        setCurrentDataset(analyzed);
        setLiveRhythm(rhythm);
        setLiveBpmTarget(targetBpm);
      }
    } catch (err) {
      console.error('Error loading preset:', err);
      // Fallback to synthetic normal
      const synth = generateSyntheticECG('normal', 15, 250, 72);
      const fallback = analyzeECGSignal('Simulated Normal ECG', synth.time, synth.amplitude, synth.fs, true, 'normal');
      setCurrentDataset(fallback);
    }
  }, []);

  // Upload handler
  const loadUploadedData = useCallback((text: string, filename: string, fs = 250, timeCol = -1, ampCol = -1) => {
    const parsed = parseECGFile(text, fs, timeCol, ampCol);
    const analyzed = analyzeECGSignal(`Uploaded: ${filename}`, parsed.time, parsed.amplitude, parsed.fs, false);
    setCurrentDataset(analyzed);
  }, []);

  // Re-run analysis on current live buffer
  const regenerateLiveAnalysis = useCallback((): ECGAnalysisResult => {
    if (!liveBuffer.length) return currentDataset.analysis;
    const time = liveBuffer.map((s) => s.time);
    const amp = liveBuffer.map((s) => s.amplitude);
    const liveDataset = analyzeECGSignal('Live Telemetry Snapshot', time, amp, 250, true, liveRhythm);
    setCurrentDataset(liveDataset);
    return liveDataset.analysis;
  }, [liveBuffer, liveRhythm, currentDataset]);

  // Export JSON
  const exportAnalysisJSON = useCallback(() => {
    const ds = currentDataset;
    const exportObject = {
      project: 'CardioPulse BioMonitor - ECG Analysis System',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      dataset: {
        name: ds.name,
        isSimulated: ds.isSimulated,
        rhythm: ds.rhythm || 'unspecified',
        samplingRateHz: ds.samplingRate,
        sampleCount: ds.rawAmplitude.length,
        durationSeconds: ds.analysis.durationSeconds,
      },
      metrics: {
        heartRateBpm: ds.analysis.heartRate,
        minBpm: ds.analysis.minHR,
        maxBpm: ds.analysis.maxHR,
        averageBpm: ds.analysis.avgHR,
        beatsDetectedCount: ds.analysis.beatsCount,
        rhythmInterpretation: ds.analysis.rhythmInterpretation,
      },
      intervals: ds.analysis.intervals,
      hrvMetrics: ds.analysis.hrv,
      signalQuality: ds.analysis.sqi,
      detectedRPeakSampleIndices: ds.analysis.rPeaks,
      rrIntervalsMilliseconds: ds.analysis.rrIntervals,
    };

    const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ecg-analysis-${ds.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [currentDataset]);

  // Export CSV
  const exportAnalysisCSV = useCallback(() => {
    const ds = currentDataset;
    let csv = '# CardioPulse BioMonitor - ECG Analysis Report\n';
    csv += `# Dataset: ${ds.name}\n`;
    csv += `# Timestamp: ${new Date().toISOString()}\n`;
    csv += `# Sampling Rate: ${ds.samplingRate} Hz\n`;
    csv += `# Heart Rate: ${ds.analysis.heartRate} BPM (Avg: ${ds.analysis.avgHR}, Min: ${ds.analysis.minHR}, Max: ${ds.analysis.maxHR})\n`;
    csv += `# Rhythm: ${ds.analysis.rhythmInterpretation}\n`;
    csv += `# Mean RR: ${ds.analysis.hrv.meanRR} ms | SDNN: ${ds.analysis.hrv.sdnn} ms | RMSSD: ${ds.analysis.hrv.rmssd} ms | pNN50: ${ds.analysis.hrv.pnn50}%\n`;
    csv += `# Signal Quality: ${ds.analysis.sqi.status.toUpperCase()} (${ds.analysis.sqi.overallScore}% - SNR ${ds.analysis.sqi.snrDb} dB)\n\n`;

    csv += 'Beat_Index,R_Peak_Sample,R_Peak_Time_s,RR_Interval_ms,Instantaneous_BPM\n';
    for (let i = 0; i < ds.analysis.rPeaks.length; i++) {
      const peakSample = ds.analysis.rPeaks[i];
      const peakTime = (peakSample / ds.samplingRate).toFixed(4);
      const rr = i > 0 && ds.analysis.rrIntervals[i - 1] ? ds.analysis.rrIntervals[i - 1].toFixed(1) : '';
      const bpm = i > 0 && ds.analysis.rrIntervals[i - 1] ? Math.round(60000 / ds.analysis.rrIntervals[i - 1]) : '';
      csv += `${i + 1},${peakSample},${peakTime},${rr},${bpm}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ecg-beats-${ds.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [currentDataset]);

  return (
    <ECGContext.Provider
      value={{
        activeTab,
        setActiveTab,
        currentDataset,
        setCurrentDataset,
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
        filterSettings,
        setFilterSettings,
        displaySettings,
        setDisplaySettings,
        loadPresetDataset,
        loadUploadedData,
        regenerateLiveAnalysis,
        exportAnalysisJSON,
        exportAnalysisCSV,
      }}
    >
      {children}
    </ECGContext.Provider>
  );
};

export function useECG() {
  const context = useContext(ECGContext);
  if (!context) {
    throw new Error('useECG must be used within an ECGProvider');
  }
  return context;
}
