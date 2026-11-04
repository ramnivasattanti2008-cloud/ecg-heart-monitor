import os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

os.makedirs('report_assets', exist_ok=True)

# -------------------------------------------------------------------------
# Figure 1: Cardiac Electrophysiology & ECG Waveform Correlation
# -------------------------------------------------------------------------
fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 6), dpi=300)

# Simulated clean P-QRS-T wave
t = np.linspace(0, 0.9, 1000)
def gaussian(t, mu, sig, amp):
    return amp * np.exp(-((t - mu)**2) / (2 * sig**2))

p_wave = gaussian(t, 0.20, 0.030, 0.18)
q_wave = gaussian(t, 0.32, 0.012, -0.15)
r_wave = gaussian(t, 0.35, 0.016, 1.35)
s_wave = gaussian(t, 0.38, 0.015, -0.28)
t_wave = gaussian(t, 0.58, 0.055, 0.35)
ecg = p_wave + q_wave + r_wave + s_wave + t_wave

ax1.plot(t, ecg, color='#0f766e', lw=2.5, label='Lead II Electrocardiogram (mV)')
ax1.axhline(0, color='#94a3b8', ls='--', lw=0.8)
ax1.set_title('Cardiac Electrical Cycle: Surface ECG Fiducial Waves & Intervals', fontsize=12, fontweight='bold', pad=10)
ax1.set_ylabel('Amplitude (mV)', fontsize=10)
ax1.set_xlim(0.05, 0.85)
ax1.set_ylim(-0.4, 1.5)

# Annotations
ax1.annotate('P Wave\n(Atrial Depolarization)', xy=(0.20, 0.18), xytext=(0.10, 0.7),
             arrowprops=dict(facecolor='#0284c7', shrink=0.08, width=1, headwidth=6),
             fontsize=9, fontweight='semibold', color='#0369a1')
ax1.annotate('QRS Complex\n(Ventricular Depolarization)', xy=(0.35, 1.35), xytext=(0.42, 1.35),
             arrowprops=dict(facecolor='#b91c1c', shrink=0.08, width=1, headwidth=6),
             fontsize=9, fontweight='semibold', color='#b91c1c')
ax1.annotate('T Wave\n(Ventricular Repolarization)', xy=(0.58, 0.35), xytext=(0.65, 0.75),
             arrowprops=dict(facecolor='#7c3aed', shrink=0.08, width=1, headwidth=6),
             fontsize=9, fontweight='semibold', color='#6d28d9')

# Intervals
ax1.axvspan(0.15, 0.32, color='#bae6fd', alpha=0.3, label='PR Interval (120-200ms)')
ax1.axvspan(0.31, 0.40, color='#fecaca', alpha=0.3, label='QRS Duration (<120ms)')
ax1.axvspan(0.31, 0.70, color='#e9d5ff', alpha=0.3, label='QT Interval (~400ms)')
ax1.legend(loc='upper right', fontsize=8)
ax1.grid(True, linestyle=':', alpha=0.6)

# Conduction Timeline / Physiology
ax2.set_xlim(0.05, 0.85)
ax2.set_ylim(0, 5)
ax2.axis('off')
conduction_steps = [
    (0.18, 4.0, '1. SA Node Fires\nPacemaker Action Potential', '#0284c7'),
    (0.26, 2.5, '2. AV Node Delay\nAllows Ventricular Filling', '#0f766e'),
    (0.35, 4.0, '3. Bundle of His & Purkinje\nRapid Ventricular Activation', '#b91c1c'),
    (0.48, 2.5, '4. ST Isoelectric Phase\nVentricular Plateau (Ca2+ Influx)', '#d97706'),
    (0.60, 4.0, '5. Ventricular Repolarization\nK+ Efflux / Diastole Recovery', '#7c3aed')
]

for x, y, label, col in conduction_steps:
    ax2.scatter(x, y, s=160, color=col, zorder=5)
    ax2.text(x, y - 0.7, label, ha='center', va='top', fontsize=8, fontweight='bold', color=col,
             bbox=dict(boxstyle='round,pad=0.3', facecolor='#f8fafc', edgecolor=col, alpha=0.9))

plt.tight_layout()
plt.savefig('report_assets/fig1_cardiac_conduction_and_ecg.png', dpi=300)
plt.close()

# -------------------------------------------------------------------------
# Figure 2: Pan-Tompkins Signal Processing Pipeline Flowchart
# -------------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(11, 4.5), dpi=300)
ax.axis('off')
ax.set_xlim(0, 11)
ax.set_ylim(0, 4)

blocks = [
    (0.8, 2.0, 'Raw ECG\nSignal (mV)\n$F_s \\geq 250$ Hz', '#334155'),
    (2.4, 2.0, 'Biquad Bandpass\n(5 - 15 Hz)\nNoise / Drift Filter', '#0284c7'),
    (4.0, 2.0, '5-Point Derivative\n$y[n] = \\frac{1}{8}[2x+x..]$\nSlope Highlight', '#0f766e'),
    (5.6, 2.0, 'Non-linear\nSquaring\n$y[n] = (x[n])^2$\nEnergy Amplification', '#d97706'),
    (7.2, 2.0, 'Moving Window\nIntegration (~150ms)\nWaveform Envelope', '#7c3aed'),
    (8.8, 2.0, 'Adaptive Dual\nThresholds & Searchback\n$THR_1, THR_2$', '#b91c1c'),
    (10.3, 2.0, 'Parabolic Peak\nRefinement\n$< 1$ ms Precision', '#059669')
]

from matplotlib.patches import FancyBboxPatch

for i, (x, y, text, color) in enumerate(blocks):
    rect = FancyBboxPatch((x - 0.65, y - 0.8), 1.3, 1.6, boxstyle="round,pad=0.08",
                          facecolor='#f8fafc', edgecolor=color, lw=2)
    ax.add_patch(rect)
    ax.text(x, y, text, ha='center', va='center', fontsize=8, fontweight='bold', color=color)
    if i < len(blocks) - 1:
        ax.annotate('', xy=(blocks[i+1][0] - 0.65, y), xytext=(x + 0.65, y),
                    arrowprops=dict(facecolor='#64748b', edgecolor='#64748b', width=1.5, headwidth=6))

ax.set_title('Architecture of the Enhanced Pan-Tompkins QRS Detection Pipeline', fontsize=12, fontweight='bold', pad=15)
plt.tight_layout()
plt.savefig('report_assets/fig2_pan_tompkins_pipeline.png', dpi=300)
plt.close()

# -------------------------------------------------------------------------
# Figure 3: Machine Learning Arrhythmia Classifier Architecture
# -------------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(10, 5), dpi=300)
ax.axis('off')
ax.set_xlim(0, 10)
ax.set_ylim(0, 6)

ax.text(5, 5.6, 'PhysioNet MIT-BIH Trained ML Arrhythmia Classifier Architecture', ha='center', fontsize=12, fontweight='bold', color='#0f172a')

# Feature Extraction Column
ax.text(1.8, 4.8, '1. Multi-Domain Features', ha='center', fontsize=10, fontweight='bold', color='#0284c7')
feats = [
    'QRS Width & Energy Area',
    'Pre-RR & Post-RR Interval Ratios',
    'ST-Segment Deviation (J+60ms)',
    'P-Wave Prominence Index',
    'T-Wave Polarity Discordance'
]
for i, f in enumerate(feats):
    ax.text(1.8, 4.0 - i * 0.7, f, ha='center', va='center', fontsize=8, color='#1e293b',
            bbox=dict(boxstyle='square,pad=0.4', facecolor='#e0f2fe', edgecolor='#38bdf8'))

# Model Box
ax.text(5.0, 4.8, '2. Trained ML Engine', ha='center', fontsize=10, fontweight='bold', color='#7c3aed')
ax.text(5.0, 2.7, 'Calibrated Softmax\nLogistic & Heuristic\nEnsemble Weights\n\n(AAMI EC57 Rules)\n$P(C_k|X) = \\frac{e^{z_k}}{\\sum e^{z_j}}$', 
        ha='center', va='center', fontsize=8.5, fontweight='semibold', color='#581c87',
        bbox=dict(boxstyle='round,pad=0.8', facecolor='#f3e8ff', edgecolor='#a855f7', lw=2))

# Diagnostic Output
ax.text(8.2, 4.8, '3. Diagnostic Class Dossier', ha='center', fontsize=10, fontweight='bold', color='#059669')
outputs = [
    ('Normal Sinus (N)', '#10b981'),
    ('Ventricular Ectopy (PVC)', '#ef4444'),
    ('Atrial Premature (APC)', '#8b5cf6'),
    ('Atrial Fibrillation (AFib)', '#f59e0b'),
    ('Conduction Block (LBBB)', '#6366f1')
]
for i, (out, col) in enumerate(outputs):
    ax.text(8.2, 4.0 - i * 0.7, out, ha='center', va='center', fontsize=8, fontweight='bold', color=col,
            bbox=dict(boxstyle='round,pad=0.4', facecolor='#f8fafc', edgecolor=col, lw=1.5))

# Arrows
ax.annotate('', xy=(3.6, 2.7), xytext=(2.8, 2.7), arrowprops=dict(facecolor='#64748b', width=1.5, headwidth=6))
ax.annotate('', xy=(7.0, 2.7), xytext=(6.4, 2.7), arrowprops=dict(facecolor='#64748b', width=1.5, headwidth=6))

plt.tight_layout()
plt.savefig('report_assets/fig3_ml_arrhythmia_classifier.png', dpi=300)
plt.close()

# -------------------------------------------------------------------------
# Figure 4: Waveform Comparison: NSR vs PVC Arrhythmia
# -------------------------------------------------------------------------
fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 5), dpi=300, sharex=True)

t_series = np.linspace(0, 3.5, 3500)
# Normal Rhythm (75 BPM, ~0.8s period)
ecg_norm = np.zeros_like(t_series)
for b in [0.2, 1.0, 1.8, 2.6]:
    ecg_norm += gaussian(t_series, b + 0.0, 0.025, 0.15)    # P
    ecg_norm += gaussian(t_series, b + 0.12, 0.010, -0.12)  # Q
    ecg_norm += gaussian(t_series, b + 0.15, 0.015, 1.25)   # R
    ecg_norm += gaussian(t_series, b + 0.18, 0.012, -0.25)  # S
    ecg_norm += gaussian(t_series, b + 0.35, 0.045, 0.30)   # T

ax1.plot(t_series, ecg_norm, color='#059669', lw=1.8)
ax1.set_title('Normal Sinus Rhythm (NSR): Uniform RR Interval & Normal Narrow QRS (<100ms)', fontsize=10, fontweight='bold')
ax1.set_ylabel('Amplitude (mV)', fontsize=9)
ax1.grid(True, linestyle=':', alpha=0.5)

# PVC Arrhythmia (Beat 3 is premature, wide QRS, compensatory pause)
ecg_pvc = np.zeros_like(t_series)
for b in [0.2, 1.0]:
    ecg_pvc += gaussian(t_series, b + 0.0, 0.025, 0.15)
    ecg_pvc += gaussian(t_series, b + 0.12, 0.010, -0.12)
    ecg_pvc += gaussian(t_series, b + 0.15, 0.015, 1.25)
    ecg_pvc += gaussian(t_series, b + 0.18, 0.012, -0.25)
    ecg_pvc += gaussian(t_series, b + 0.35, 0.045, 0.30)

# Premature wide ectopic beat at 1.55s
b_pvc = 1.55
ecg_pvc += gaussian(t_series, b_pvc + 0.10, 0.045, -1.1)    # Deep broad S/Q
ecg_pvc += gaussian(t_series, b_pvc + 0.15, 0.035, 1.45)    # Broad notched R
ecg_pvc += gaussian(t_series, b_pvc + 0.32, 0.070, -0.45)   # Inverted discordant T

# Subsequent delayed sinus beat at 2.7s (compensatory pause)
b_post = 2.7
ecg_pvc += gaussian(t_series, b_post + 0.0, 0.025, 0.15)
ecg_pvc += gaussian(t_series, b_post + 0.12, 0.010, -0.12)
ecg_pvc += gaussian(t_series, b_post + 0.15, 0.015, 1.25)
ecg_pvc += gaussian(t_series, b_post + 0.18, 0.012, -0.25)
ecg_pvc += gaussian(t_series, b_post + 0.35, 0.045, 0.30)

ax2.plot(t_series, ecg_pvc, color='#dc2626', lw=1.8)
ax2.annotate('Premature Ventricular Contraction (PVC)\nWide QRS (>120ms) + Inverted T-Wave', 
             xy=(1.70, 1.45), xytext=(1.85, 1.6),
             arrowprops=dict(facecolor='#b91c1c', shrink=0.08, width=1, headwidth=6),
             fontsize=8.5, fontweight='bold', color='#b91c1c')
ax2.annotate('Compensatory Pause (RR > 1150ms)', 
             xy=(2.2, 0.0), xytext=(2.0, -0.6),
             arrowprops=dict(facecolor='#475569', shrink=0.08, width=1, headwidth=5),
             fontsize=8, fontweight='bold', color='#334155')

ax2.set_title('Ventricular Arrhythmia: Isolated PVC with Prolonged Compensatory Pause', fontsize=10, fontweight='bold')
ax2.set_xlabel('Time (seconds)', fontsize=9)
ax2.set_ylabel('Amplitude (mV)', fontsize=9)
ax2.grid(True, linestyle=':', alpha=0.5)

plt.tight_layout()
plt.savefig('report_assets/fig4_ecg_normal_vs_pvc.png', dpi=300)
plt.close()

# -------------------------------------------------------------------------
# Figure 5: HRV Analysis: Poincaré Plot & Tachogram
# -------------------------------------------------------------------------
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 4.5), dpi=300)

# Simulated RR tachogram
np.random.seed(42)
n_beats = 60
mean_rr = 800
noise = np.random.normal(0, 35, n_beats)
rr = mean_rr + noise

ax1.plot(range(1, n_beats + 1), rr, marker='o', markersize=4, color='#0284c7', lw=1.5)
ax1.set_title('Beat-to-Beat RR Tachogram ($RR_n$ Series)', fontsize=10, fontweight='bold')
ax1.set_xlabel('Beat Sequence Index', fontsize=9)
ax1.set_ylabel('RR Interval (ms)', fontsize=9)
ax1.grid(True, linestyle=':', alpha=0.6)

# Poincaré Plot: RR_n vs RR_{n+1}
rr_n = rr[:-1]
rr_next = rr[1:]
ax2.scatter(rr_n, rr_next, color='#7c3aed', alpha=0.7, s=40, edgecolors='none', label='Beat Transitions')
ax2.plot([680, 920], [680, 920], color='#94a3b8', ls='--', label='Identity Line ($RR_n = RR_{n+1}$)')

# Ellipse representation for SD1 / SD2
center_x, center_y = np.mean(rr_n), np.mean(rr_next)
from matplotlib.patches import Ellipse
sd1 = np.std(rr_next - rr_n) / np.sqrt(2)
sd2 = np.std(rr_next + rr_n) / np.sqrt(2)
ellipse = Ellipse((center_x, center_y), width=2*sd2, height=2*sd1, angle=45,
                  facecolor='none', edgecolor='#b91c1c', lw=2, label=f'SD1={sd1:.1f}ms, SD2={sd2:.1f}ms')
ax2.add_patch(ellipse)

ax2.set_title('Poincaré Phase-Space Plot ($RR_n$ vs $RR_{n+1}$)', fontsize=10, fontweight='bold')
ax2.set_xlabel('$RR_n$ (ms)', fontsize=9)
ax2.set_ylabel('$RR_{n+1}$ (ms)', fontsize=9)
ax2.legend(loc='lower right', fontsize=8)
ax2.grid(True, linestyle=':', alpha=0.6)

plt.tight_layout()
plt.savefig('report_assets/fig5_hrv_poincare_tachogram.png', dpi=300)
plt.close()

# -------------------------------------------------------------------------
# Figure 6: Full Stack System Architecture
# -------------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(10, 5), dpi=300)
ax.axis('off')
ax.set_xlim(0, 10)
ax.set_ylim(0, 6)

ax.text(5, 5.6, 'CardioPulse BioMonitor: End-to-End Modular System Architecture', ha='center', fontsize=12, fontweight='bold', color='#0f172a')

layers = [
    (1.5, 3.2, 'DATA INGESTION\n& SYNTHESIS\n\n• PhysioNet MIT-BIH CSV\n• Multi-signal (ECG, EMG, EEG)\n• Cardiac Dipole Simulator\n• Universal TSV/CSV Parser', '#0284c7', '#e0f2fe'),
    (5.0, 3.2, 'SIGNAL PROCESSING\n& AI ENGINE\n\n• RBJ Biquad Filter Chain\n• Sub-sample Pan-Tompkins\n• Multi-wave Fiducial Extractor\n• Trained Arrhythmia Classifier\n• Welch Spectral FFT (0-40Hz)', '#0f766e', '#ccfbf1'),
    (8.5, 3.2, 'INTERACTIVE UI\n& CLINICAL SUITE\n\n• Decimated 60 FPS Canvas\n• Cardiologist Digital Calipers\n• P-QRS-T Beat Template\n• Bedside Web Audio Beep\n• CSV, JSON & PDF Reports', '#7c3aed', '#f3e8ff')
]

for x, y, text, col, bg in layers:
    rect = FancyBboxPatch((x - 1.4, y - 1.8), 2.8, 3.6, boxstyle="round,pad=0.15", facecolor=bg, edgecolor=col, lw=2)
    ax.add_patch(rect)
    ax.text(x, y, text, ha='center', va='center', fontsize=8.5, fontweight='bold', color=col)

ax.annotate('', xy=(3.5, 3.2), xytext=(2.9, 3.2), arrowprops=dict(facecolor='#475569', width=2, headwidth=7))
ax.annotate('', xy=(7.0, 3.2), xytext=(6.4, 3.2), arrowprops=dict(facecolor='#475569', width=2, headwidth=7))

plt.tight_layout()
plt.savefig('report_assets/fig6_system_architecture.png', dpi=300)
plt.close()

print('All 6 high-resolution medical report diagrams generated successfully!')
