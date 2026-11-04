// Radix-2 Cooley-Tukey Fast Fourier Transform (FFT) for Power Spectral Density (PSD)

export function nextPow2(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(Math.max(2, n))));
}

export function computeFFTSpectrum(
  signal: number[] | Float64Array, 
  fs: number, 
  maxFreq = 60
): { frequencies: number[]; powers: number[]; peakFreq: number } {
  const n0 = signal.length;
  if (n0 < 16) return { frequencies: [], powers: [], peakFreq: 0 };

  // Remove DC component (mean)
  let sum = 0;
  for (let i = 0; i < n0; i++) sum += signal[i];
  const meanVal = sum / n0;

  const N = nextPow2(n0);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  let winPower = 0;

  // Apply Hann window
  for (let i = 0; i < n0; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n0 - 1)));
    re[i] = (signal[i] - meanVal) * w;
    winPower += w * w;
  }

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }

  // Butterfly passes
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len >> 1; k++) {
        const a = i + k;
        const b = a + (len >> 1);
        const tr = cr * re[b] - ci * im[b];
        const ti = cr * im[b] + ci * re[b];
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }

  const half = N >> 1;
  const df = fs / N;
  const scale = 1 / (fs * (winPower || 1));

  const frequencies: number[] = [];
  const powers: number[] = [];
  let peakFreq = 0;
  let maxP = -Infinity;

  for (let k = 1; k <= half; k++) {
    const freq = k * df;
    if (freq > maxFreq) break;

    const p = (re[k] * re[k] + im[k] * im[k]) * scale * 2;
    frequencies.push(Number(freq.toFixed(2)));
    powers.push(Number(p.toFixed(5)));

    if (p > maxP) {
      maxP = p;
      peakFreq = freq;
    }
  }

  return { frequencies, powers, peakFreq: Number(peakFreq.toFixed(2)) };
}
