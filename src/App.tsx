import React from 'react';
import { ECGProvider, useECG } from './context/ECGContext';
import { Navbar } from './components/Navbar';
import { OverviewDashboard } from './components/OverviewDashboard';
import { LiveMonitor } from './components/LiveMonitor';
import { UploadECG } from './components/UploadECG';
import { SignalAnalysis } from './components/SignalAnalysis';
import { HeartRateHRV } from './components/HeartRateHRV';
import { Reports } from './components/Reports';
import { AboutProject } from './components/AboutProject';
import { Activity } from 'lucide-react';

const MainContent: React.FC = () => {
  const { activeTab, displaySettings } = useECG();

  // Apply theme background class
  let gridBgClass = 'ecg-grid';
  if (displaySettings.gridTheme === 'pink') {
    gridBgClass = 'ecg-grid-pink';
  } else if (displaySettings.gridTheme === 'dark') {
    gridBgClass = 'bg-[#080d18]';
  }

  return (
    <div className={`min-h-screen ${gridBgClass} transition-colors duration-300 flex flex-col`}>
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && <OverviewDashboard />}
        {activeTab === 'monitor' && <LiveMonitor />}
        {activeTab === 'upload' && <UploadECG />}
        {activeTab === 'analysis' && <SignalAnalysis />}
        {activeTab === 'hrv' && <HeartRateHRV />}
        {activeTab === 'reports' && <Reports />}
        {activeTab === 'about' && <AboutProject />}
      </main>

      {/* Global Clinical Telemetry Footer */}
      <footer className="mt-auto border-t border-slate-800 bg-[#070b14]/90 backdrop-blur py-6 text-slate-400 font-mono text-xs no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-white font-bold">CardioPulse BioMonitor</span>
            <span>&bull;</span>
            <span className="text-slate-500">Biomedical ECG Signal Telemetry</span>
          </div>

          <div className="flex items-center space-x-4 text-[11px] text-slate-500">
            <span>Pan-Tompkins QRS Detection</span>
            <span>&bull;</span>
            <span>Task Force HRV Standard</span>
            <span>&bull;</span>
            <span className="text-emerald-500 font-semibold">Client-Side Zero-Install</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <ECGProvider>
      <MainContent />
    </ECGProvider>
  );
}

export default App;
