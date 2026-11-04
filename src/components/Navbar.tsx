import React from 'react';
import { useECG } from '../context/ECGContext';
import type { NavTab } from '../context/ECGContext';
import { 
  Activity, 
  Radio, 
  Sliders, 
  HeartPulse, 
  FileText, 
  Info, 
  Volume2, 
  VolumeX, 
  Sun,
  Moon,
  ExternalLink
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    appTheme, 
    setAppTheme, 
    displaySettings, 
    setDisplaySettings 
  } = useECG();

  const isDark = appTheme === 'dark';

  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'analyzer', label: 'Signal Analyzer', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'monitor', label: 'Live Monitor', icon: <Radio className="w-3.5 h-3.5" /> },
    { id: 'analysis', label: 'Signal Processing', icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'hrv', label: 'Heart Rate & HRV', icon: <HeartPulse className="w-3.5 h-3.5" /> },
    { id: 'reports', label: 'Reports', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'about', label: 'About', icon: <Info className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className={`sticky top-0 z-50 border-b transition-colors duration-200 no-print ${
      isDark 
        ? 'bg-[#0b0f19]/90 border-slate-800 text-slate-100 backdrop-blur' 
        : 'bg-[#f4f3ef]/90 border-[#e4e2db] text-[#15161b] backdrop-blur'
    }`}>
      {/* Upper Header Row */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        
        {/* Brand Logo & Name */}
        <div 
          className="flex items-center gap-3 cursor-pointer select-none" 
          onClick={() => setActiveTab('analyzer')}
        >
          <span className="block w-9 h-6 text-current" aria-hidden="true">
            <svg viewBox="0 0 48 24" className="w-9 h-6">
              <polyline 
                points="0,12 8,12 12,4 18,20 24,8 28,12 36,12 40,9 44,15 48,12" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div>
            <h1 className="text-base font-bold tracking-tight leading-tight">
              Biomedical Signal Analyzer
            </h1>
            <p className="font-mono text-[10px] tracking-widest uppercase text-[#8c8c92] mt-0.5">
              ECG &bull; EMG &bull; EEG &bull; IN-BROWSER SIGNAL METRICS
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 font-mono text-xs">
          
          {/* Sound Toggle */}
          <button
            onClick={() => setDisplaySettings((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
            className={`px-3 py-1.5 border rounded-[2px] transition-colors flex items-center gap-1.5 ${
              isDark
                ? (displaySettings.soundEnabled ? 'border-emerald-500 bg-emerald-950/60 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-400')
                : (displaySettings.soundEnabled ? 'border-[#1d40d0] bg-[#1d40d0]/10 text-[#1d40d0]' : 'border-[#e4e2db] bg-white text-[#56565c] hover:border-[#15161b]')
            }`}
            title="Heart tone synthesizer"
          >
            {displaySettings.soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{displaySettings.soundEnabled ? 'Tone On' : 'Muted'}</span>
          </button>

          {/* Theme Toggle (Swiss Paper vs Dark Monitor) */}
          <button
            onClick={() => setAppTheme(isDark ? 'swiss' : 'dark')}
            className={`px-3 py-1.5 border rounded-[2px] transition-colors flex items-center gap-1.5 ${
              isDark
                ? 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                : 'border-[#15161b] bg-transparent text-[#15161b] hover:bg-[#15161b] hover:text-white'
            }`}
            title="Switch theme"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isDark ? 'Swiss Theme' : 'Dark Mode'}</span>
          </button>

          {/* GitHub Ghost Button (as in reference app) */}
          <a
            href="https://github.com/ramnivasattanti2008-cloud/ecg-heart-monitor"
            target="_blank"
            rel="noopener noreferrer"
            className={`px-3 py-1.5 border rounded-[2px] transition-colors hidden sm:flex items-center gap-1.5 font-semibold ${
              isDark
                ? 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
                : 'border-[#15161b] text-[#15161b] hover:bg-[#15161b] hover:text-white'
            }`}
          >
            <span>GitHub</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Navigation Sub-bar */}
      <div className={`border-t ${isDark ? 'border-slate-800/80 bg-slate-950/40' : 'border-[#eeece6] bg-[#f8f7f4]'}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex space-x-1 overflow-x-auto py-1.5 scrollbar-none">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-[2px] font-mono text-xs font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? (isDark 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                        : 'bg-[#15161b] text-white')
                    : (isDark 
                        ? 'text-slate-400 hover:text-white hover:bg-slate-800' 
                        : 'text-[#56565c] hover:text-[#15161b] hover:bg-white')
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
