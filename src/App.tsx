import React from 'react';
import { ECGProvider, useECG } from './context/ECGContext';
import { Navbar } from './components/Navbar';
import { ReferenceSignalAnalyzer } from './components/ReferenceSignalAnalyzer';
import { LiveMonitor } from './components/LiveMonitor';
import { OverviewDashboard } from './components/OverviewDashboard';
import { UploadECG } from './components/UploadECG';
import { SignalAnalysis } from './components/SignalAnalysis';
import { HeartRateHRV } from './components/HeartRateHRV';
import { Reports } from './components/Reports';
import { AboutProject } from './components/AboutProject';

const MainContent: React.FC = () => {
  const { activeTab, appTheme } = useECG();
  const isDark = appTheme === 'dark';

  return (
    <div className={`min-h-screen transition-colors duration-200 flex flex-col ${
      isDark ? 'bg-[#0a0e17] text-slate-100 ecg-grid' : 'bg-[#f4f3ef] text-[#15161b]'
    }`}>
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'analyzer' && <ReferenceSignalAnalyzer />}
        {activeTab === 'monitor' && <LiveMonitor />}
        {activeTab === 'overview' && <OverviewDashboard />}
        {activeTab === 'upload' && <UploadECG />}
        {activeTab === 'analysis' && <SignalAnalysis />}
        {activeTab === 'hrv' && <HeartRateHRV />}
        {activeTab === 'reports' && <Reports />}
        {activeTab === 'about' && <AboutProject />}
      </main>

      {/* Global Clinical Telemetry Footer */}
      <footer className={`mt-auto border-t py-6 font-mono text-xs no-print transition-colors ${
        isDark ? 'border-slate-800 bg-[#070b14] text-slate-500' : 'border-[#e4e2db] bg-[#f4f3ef] text-[#8c8c92]'
      }`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-current">Biomedical Signal Analyzer</span>
            <span>&bull;</span>
            <span>Built with React, TypeScript &amp; Canvas</span>
          </div>

          <div className="flex items-center space-x-3 text-[11px]">
            <span>Pan-Tompkins QRS</span>
            <span>&bull;</span>
            <span>HRV Engine</span>
            <span>&bull;</span>
            <span className="text-current font-semibold">100% Client-Side</span>
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
