// Digital Signal Processing Filters for Biomedical ECG Signals
// Biquad filters using Robert Bristow-Johnson (RBJ) audio EQ cookbook formulas

export interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/** Standard second-order lowpass filter */
export function biquadLowpass(f0: number, fs: number, Q = Math.SQRT1_2): BiquadCoeffs {
  const w0 = (2 * Math.PI * f0) / fs;
  const c = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Q);
  const a0 = 1 + alpha;
  return {
    b0: ((1 - c) / 2) / a0,
    b1: (1 - c) / a0,
    b2: ((1 - c) / 2) / a0,
    a1: (-2 * c) / a0,
    a2: (1 - alpha) / a0,
  };
}

/** Standard second-order highpass filter */
export function biquadHighpass(f0: number, fs: number, Q = Math.SQRT1_2): BiquadCoeffs {
  const w0 = (2 * Math.PI * f0) / fs;
  const c = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Q);
  const a0 = 1 + alpha;
  return {
    b0: ((1 + c) / 2) / a0,
    b1: (-(1 + c)) / a0,
    b2: ((1 + c) / 2) / a0,
    a1: (-2 * c) / a0,
    a2: (1 - alpha) / a0,
  };
}

/** Standard second-order notch (band-stop) filter for 50/60 Hz powerline interference */
export function biquadNotch(f0: number, fs: number, Q = 10): BiquadCoeffs {
  const w0 = (2 * Math.PI * f0) / fs;
  const c = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Q);
  const a0 = 1 + alpha;
  return {
    b0: 1 / a0,
    b1: (-2 * c) / a0,
    b2: 1 / a0,
    a1: (-2 * c) / a0,
    a2: (1 - alpha) / a0,
  };
}

/** Apply a biquad filter in Transposed Direct Form II */
export function applyBiquad(signal: number[] | Float64Array, coeffs: BiquadCoeffs): Float64Array {
  const n = signal.length;
  const y = new Float64Array(n);
  let z1 = 0;
  let z2 = 0;
  for (let i = 0; i < n; i++) {
    const xn = signal[i];
    const yn = coeffs.b0 * xn + z1;
    z1 = coeffs.b1 * xn - coeffs.a1 * yn + z2;
    z2 = coeffs.b2 * xn - coeffs.a2 * yn;
    y[i] = yn;
  }
  return y;
}

/** Zero-phase forward-backward filtering to avoid phase distortion */
export function applyBiquadFiltFilt(signal: number[] | Float64Array, coeffs: BiquadCoeffs): Float64Array {
  const forward = applyBiquad(signal, coeffs);
  // Reverse
  const n = forward.length;
  const reversed = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    reversed[i] = forward[n - 1 - i];
  }
  const backward = applyBiquad(reversed, coeffs);
  // Reverse back
  const result = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = backward[n - 1 - i];
  }
  return result;
}

/** Remove slow baseline wander using centered moving average subtraction (O(N) with prefix sums) */
export function removeBaselineWander(signal: number[] | Float64Array, fs: number, windowSec = 0.2): Float64Array {
  const n = signal.length;
  const win = Math.max(1, Math.round(windowSec * fs));
  const half = Math.floor(win / 2);
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    prefix[i + 1] = prefix[i] + signal[i];
  }
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - half);
    const b = Math.min(n, i + half + 1);
    const avg = (prefix[b] - prefix[a]) / (b - a);
    out[i] = signal[i] - avg;
  }
  return out;
}

/** Clinical ECG filter chain: Highpass 0.5Hz + Notch (50/60Hz) + Lowpass 40Hz */
export function applyECGFilters(
  signal: number[] | Float64Array, 
  fs: number,
  options: {
    removeBaseline?: boolean;
    notch50?: boolean;
    notch60?: boolean;
    lowpass40?: boolean;
  } = {}
): Float64Array {
  const {
    removeBaseline = true,
    notch50 = false,
    notch60 = false,
    lowpass40 = true,
  } = options;

  let current: Float64Array = signal instanceof Float64Array ? new Float64Array(signal) : new Float64Array(signal);

  // 1. Baseline wander removal
  if (removeBaseline) {
    current = removeBaselineWander(current, fs, 0.4);
  }

  // 2. Powerline 50Hz Notch filter (if fs > 100Hz)
  if (notch50 && fs > 100) {
    const notchCoeffs = biquadNotch(50, fs, 8);
    current = applyBiquad(current, notchCoeffs);
  }

  // 3. Powerline 60Hz Notch filter (if fs > 120Hz)
  if (notch60 && fs > 120) {
    const notchCoeffs = biquadNotch(60, fs, 8);
    current = applyBiquad(current, notchCoeffs);
  }

  // 4. Muscle noise Lowpass filter (40Hz cutoff, standard ECG monitor band)
  if (lowpass40 && fs > 80) {
    const lpCoeffs = biquadLowpass(40, fs);
    current = applyBiquad(current, lpCoeffs);
  }

  return current;
}
