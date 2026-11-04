import React, { useState, useRef } from 'react';
import { useECG } from '../context/ECGContext';
import { 
  UploadCloud, 
  AlertCircle, 
  Database, 
  Play, 
  Sliders, 
  CheckCircle2, 
  FileCode2 
} from 'lucide-react';
import { parseECGFile, analyzeECGSignal } from '../utils/csvParser';

export const UploadECG: React.FC = () => {
  const { 
    setCurrentDataset, 
    loadPresetDataset, 
    currentDataset 
  } = useECG();

  const [dragActive, setDragActive] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fileRawText, setFileRawText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  
  // Column mapping & Fs configuration
  const [headers, setHeaders] = useState<string[]>([]);
  const [timeColIdx, setTimeColIdx] = useState<number>(-1);
  const [ampColIdx, setAmpColIdx] = useState<number>(0);
  const [customFs, setCustomFs] = useState<number>(250);
  const [derivedFsDetected, setDerivedFsDetected] = useState<boolean>(false);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Process text data from file
  const handleFileText = (text: string, name: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setFileName(name);
    setFileRawText(text);

    try {
      const parsed = parseECGFile(text, customFs);
      setHeaders(parsed.headers);
      setCustomFs(parsed.fs);
      setDerivedFsDetected(parsed.derivedFs);

      // Create preview rows (first 6 rows)
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0).slice(0, 6);
      const splitPreview = lines.map((l) => l.split(/[\s,;\t]+/).map((s) => s.trim()));
      setPreviewRows(splitPreview);

      // Immediately run analysis with auto-detected columns
      const dataset = analyzeECGSignal(name, parsed.time, parsed.amplitude, parsed.fs, false);
      setCurrentDataset(dataset);
      setSuccessMessage(`File "${name}" parsed successfully: ${parsed.amplitude.length.toLocaleString()} samples at ${parsed.fs} Hz.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse ECG file.';
      setErrorMessage(msg);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleFileText(text, file.name);
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read file from disk.');
    };
    reader.readAsText(file);
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleFileText(text, file.name);
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read dropped file.');
    };
    reader.readAsText(file);
  };

  // Re-run analysis when user manually changes columns or Fs
  const handleApplyCustomMapping = () => {
    if (!fileRawText) return;
    setErrorMessage(null);
    try {
      const parsed = parseECGFile(fileRawText, customFs, timeColIdx, ampColIdx);
      const dataset = analyzeECGSignal(fileName || 'Custom ECG', parsed.time, parsed.amplitude, parsed.fs, false);
      setCurrentDataset(dataset);
      setSuccessMessage(`Custom mapping applied: Column ${ampColIdx + 1} analyzed with Fs = ${parsed.fs} Hz.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze custom mapping.';
      setErrorMessage(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-emerald-400" />
              <span>ECG Data Ingestion &amp; Presets</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Supports CSV, TXT, TSV, and whitespace-delimited ECG telemetry with header detection and automatic Fs discovery.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
            Active: <strong className="text-emerald-400">{currentDataset.name}</strong>
          </div>
        </div>
      </div>

      {/* Main Grid: Upload Dropzone on Left, Built-in Presets on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Dropzone & File Input */}
        <div className="space-y-4">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              dragActive 
                ? 'border-emerald-400 bg-emerald-950/20 shadow-lg shadow-emerald-500/10' 
                : 'border-slate-700 bg-slate-900/60 hover:border-emerald-500/50 hover:bg-slate-900/80'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.dat,.tsv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                <UploadCloud className="w-7 h-7 animate-bounce" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white font-mono">
                  Drag &amp; Drop ECG File Here or <span className="text-emerald-400 underline">Browse</span>
                </p>
                <p className="text-xs text-slate-400 font-mono">
                  Accepts .csv, .txt, .dat with comma, tab, semicolon, or space delimiters
                </p>
              </div>
            </div>
          </div>

          {/* Error / Success Notifications */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-start gap-2.5 shadow-md">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Parsing Error:</strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-start gap-2.5 shadow-md">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Success:</strong>
                <span>{successMessage}</span>
              </div>
            </div>
          )}

          {/* Interactive Column Mapper (if file loaded) */}
          {headers.length > 0 && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300 border-b border-slate-800 pb-2">
                <span className="font-bold uppercase flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <span>Column Mapping &amp; Sampling Rate</span>
                </span>
                {derivedFsDetected && (
                  <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
                    Fs auto-derived from time
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div>
                  <label className="text-slate-400 block mb-1">Time Axis Column:</label>
                  <select
                    value={timeColIdx}
                    onChange={(e) => setTimeColIdx(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value={-1}>[Auto / Synthesize from Fs]</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>Col {i + 1}: {h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">ECG Signal Column:</label>
                  <select
                    value={ampColIdx}
                    onChange={(e) => setAmpColIdx(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    {headers.map((h, i) => (
                      <option key={i} value={i}>Col {i + 1}: {h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Sampling Rate (Hz):</label>
                  <input
                    type="number"
                    min="20"
                    max="10000"
                    value={customFs}
                    onChange={(e) => setCustomFs(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
              </div>

              <button
                onClick={handleApplyCustomMapping}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold rounded-lg transition-colors mt-2"
              >
                Re-Analyze with Custom Configuration
              </button>
            </div>
          )}
        </div>

        {/* 1-Click Preset Recordings */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <Database className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
              Clinical &amp; Physiological Datasets
            </h3>
          </div>

          <p className="text-xs text-slate-400 font-mono">
            Load validated clinical recordings from the PhysioNet MIT-BIH Arrhythmia Database or synthetic reference models with one click:
          </p>

          <div className="space-y-2.5">
            {[
              {
                id: 'file:ecg_normal.csv',
                title: 'PhysioNet MIT-BIH Normal Sinus',
                desc: 'Clean Lead II recording with standard P-QRS-T complexes and minimal artifact (360 Hz).',
                tag: 'MIT-BIH',
                tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
              },
              {
                id: 'file:ecg_tachycardia.csv',
                title: 'PhysioNet MIT-BIH Sinus Tachycardia',
                desc: 'Elevated rate (> 125 BPM) with narrow QRS complexes and short RR intervals (360 Hz).',
                tag: 'TACHYCARDIA',
                tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
              },
              {
                id: 'file:ecg_pvc.csv',
                title: 'PhysioNet MIT-BIH PVC Arrhythmia',
                desc: 'Premature Ventricular Contractions displaying wide, bizarre morphology and post-PVC pauses.',
                tag: 'ARRHYTHMIA',
                tagColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
              },
              {
                id: 'file:ecg_noisy.csv',
                title: 'PhysioNet MIT-BIH High-Noise Recording',
                desc: 'Severe respiration baseline drift, 50/60 Hz powerline hum, and patient muscle tremor.',
                tag: 'ARTIFACTS',
                tagColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
              },
              {
                id: 'synth_afib',
                title: 'Simulated Atrial Fibrillation (AFib)',
                desc: 'Mathematical model with absent P waves, irregular chaotic RR intervals, and f-wave baseline.',
                tag: 'SIMULATED',
                tagColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
              },
            ].map((p) => (
              <div
                key={p.id}
                className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between gap-4 transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-white font-mono">{p.title}</h4>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${p.tagColor}`}>
                      {p.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{p.desc}</p>
                </div>
                <button
                  onClick={() => {
                    loadPresetDataset(p.id);
                    setSuccessMessage(`Loaded preset: ${p.title}`);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white font-mono text-xs font-medium transition-all shrink-0 flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Load</span>
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Raw Data Preview Table */}
      {previewRows.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-300 font-bold uppercase flex items-center gap-1.5">
              <FileCode2 className="w-4 h-4 text-emerald-400" />
              <span>Raw File Text Preview (First 5 Rows)</span>
            </span>
            <span className="text-slate-500 text-[11px]">{previewRows.length} sample lines displayed</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 text-[11px]">
                  {previewRows[0].map((_, i) => (
                    <th key={i} className="p-2 border border-slate-800">
                      Column {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-800/40">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="p-2 border border-slate-800/60 text-slate-400">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
