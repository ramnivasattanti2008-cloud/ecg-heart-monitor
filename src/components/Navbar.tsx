import React from 'react';
import { useECG } from '../context/ECGContext';
import type { NavTab } from '../context/ECGContext';
import { 
  Activity, 
  Radio, 
  UploadCloud, 
  Sliders, 
  HeartPulse, 
  FileText, 
  Info, 
  Volume2, 
  VolumeX, 
  Palette,
  AlertCircle
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    isLiveRunning, 
    liveCurrentBpm, 
    displaySettings, 
    setDisplaySettings,
    currentDataset 
  } = useECG();

  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
    { id: 'monitor', label: 'Live Monitor', icon: <Radio className="w-4 h-4" />, badge: isLiveRunning ? 'LIVE' : 'PAUSED' },
    { id: 'upload', label: 'Upload & Presets', icon: <UploadCloud className="w-4 h-4" /> },
    { id: 'analysis', label: 'Signal Processing', icon: <Sliders className="w-4 h-4" /> },
    { id: 'hrv', label: 'Heart Rate & HRV', icon: <HeartPulse className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports', icon: <FileText className="w-4 h-4" /> },
    { id: 'about', label: 'About', icon: <Info className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#0c1220]/95 backdrop-blur border-b border-slate-800 text-slate-100 no-print">
      {/* Top Telemetry Strip */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('overview')}>
            <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 shadow-sm shadow-emerald-500/20">
              <Activity className="w-6 h-6 animate-pulse" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-75" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5 font-mono">
                  CardioPulse <span className="text-emerald-400 font-semibold">BioMonitor</span>
                </span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block tracking-wide">
                Biomedical ECG Signal Processing &amp; Diagnostic HRV Suite
              </p>
            </div>
          </div>

          {/* Center Telemetry Status Badge */}
          <div className="hidden md:flex items-center space-x-3 bg-slate-900/90 px-3.5 py-1.5 rounded-full border border-slate-800">
            <div className="flex items-center space-x-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isLiveRunning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-xs font-mono font-medium text-slate-300">
                {isLiveRunning ? 'STREAMING' : 'IDLE'}
              </span>
            </div>
            <div className="h-3 w-px bg-slate-700" />
            <div className="flex items-center space-x-1.5 text-xs font-mono text-emerald-400">
              <HeartPulse className="w-3.5 h-3.5" />
              <span className="font-bold text-sm">{liveCurrentBpm}</span>
              <span className="text-[10px] text-slate-400">BPM</span>
            </div>
            {currentDataset.isSimulated && (
              <>
                <div className="h-3 w-px bg-slate-700" />
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  Simulated
                </span>
              </>
            )}
          </div>

          {/* Controls: Audio Beep & Grid Theme */}
          <div className="flex items-center space-x-2">
            {/* Audio Heart Beep Toggle */}
            <button
              onClick={() => setDisplaySettings((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
              title={displaySettings.soundEnabled ? 'Mute Heart Beep Sound' : 'Enable Hospital Heart Beep Sound'}
              className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${
                displaySettings.soundEnabled 
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50' 
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {displaySettings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{displaySettings.soundEnabled ? 'Tone On' : 'Tone Muted'}</span>
            </button>

            {/* Grid Theme Selector */}
            <div className="relative group">
              <button
                className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1"
                title="Change ECG Grid Theme"
              >
                <Palette className="w-4 h-4 text-emerald-400" />
                <span className="text-xs uppercase font-mono hidden sm:inline">{displaySettings.gridTheme}</span>
              </button>
              <div className="absolute right-0 mt-1 w-36 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 hidden group-hover:block group-focus-within:block z-50">
                <button
                  onClick={() => setDisplaySettings((prev) => ({ ...prev, gridTheme: 'green' }))}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-emerald-400 flex items-center justify-between"
                >
                  <span>Phosphor Green</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </button>
                <button
                  onClick={() => setDisplaySettings((prev) => ({ ...prev, gridTheme: 'pink' }))}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-rose-400 flex items-center justify-between"
                >
                  <span>Paper Red/Pink</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                </button>
                <button
                  onClick={() => setDisplaySettings((prev) => ({ ...prev, gridTheme: 'dark' }))}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-cyan-400 flex items-center justify-between"
                >
                  <span>Graphite Minimal</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/80">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                    isLiveRunning ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Medical Disclaimer Banner */}
      <div className="bg-amber-950/30 border-b border-amber-900/40 px-4 py-1 text-[11px] text-amber-200/80 flex items-center justify-center space-x-2 font-mono">
        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>For educational and research simulation only. Not a medical diagnostic device.</span>
      </div>
    </header>
  );
};
