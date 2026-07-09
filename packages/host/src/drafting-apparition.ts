// The drafting apparition — the generation-time loading state rendered as a
// conjuring: 1-bit Bayer-dithered ink dots on a low-res buffer, upscaled with
// smoothing off. Before structure exists the frame holds a formless breathing
// mist; as validated preview nodes stream in, abstract skeleton blocks
// condense out of the mist grain-by-grain — accent ink while a block is still
// forming, settling into text ink once it lands. A repair pass destabilizes
// the dots instead of freezing them.
//
// Everything here is host-owned and driven only by validated stream metadata
// (phase rank + node ids). No model output is painted. Ink colors resolve
// from the same fingerprint token source as the final artifact, so two
// fingerprints conjure visibly different ghosts.

const TEXEL_PX = 3; // CSS px per dither texel
const DOT_ALPHA = 0.85;
const FPS = 20;
const CONJURE_SECONDS = 1.1; // per-block condensation time
const SHIMMER_SPEED = 0.05; // buffer heights per second, drifting band

const BAYER8 = (() => {
  const m = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21],
  ];
  const flat = new Float32Array(64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) flat[y * 8 + x] = (m[y]![x]! + 0.5) / 64;
  return flat;
})();

function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Cheap bilinear value noise on an integer lattice. */
function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

type Rgb = [number, number, number];

/** Resolve a token-driven color to rgb by probing computed style. */
function resolveInk(host: HTMLElement, cssColor: string, fallback: Rgb): Rgb {
  try {
    const probe = document.createElement('span');
    probe.style.color = cssColor;
    host.appendChild(probe);
    const m = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g);
    probe.remove();
    if (m && m.length >= 3) return [Number(m[0]), Number(m[1]), Number(m[2])];
  } catch {
    // fall through
  }
  return fallback;
}

export interface ApparitionUpdate {
  /** Monotonic-ish generation phase rank (0 planning .. 5 finalizing). */
  phaseRank: number;
  /** Ids of validated preview nodes, in stream order. */
  nodeIds: string[];
  /** True while a repair pass is re-running earlier phases. */
  repair: boolean;
}

export interface ApparitionHandle {
  update(state: ApparitionUpdate): void;
  destroy(): void;
}

interface Block {
  id: string;
  birth: number; // seconds, performance.now()/1000
}

/**
 * Mount the apparition canvas into a drafting root. Returns null when a 2d
 * canvas context is unavailable (e.g. non-browser DOM); callers should fall
 * back to the static CSS drafting treatment.
 */
export function mountDraftingApparition(host: HTMLElement): ApparitionHandle | null {
  let canvas: HTMLCanvasElement;
  let outCtx: CanvasRenderingContext2D | null;
  let loCtx: CanvasRenderingContext2D | null;
  const lo = document.createElement('canvas');
  try {
    canvas = document.createElement('canvas');
    outCtx = canvas.getContext('2d');
    loCtx = lo.getContext('2d');
  } catch {
    return null;
  }
  if (!outCtx || !loCtx) return null;
  const out = outCtx;
  const low = loCtx;

  canvas.className = 'summon-drafting__apparition';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const reducedMotion =
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let lw = 0;
  let lh = 0;
  let img: ImageData | null = null;
  // Per-texel static fields, rebuilt on resize / layout change.
  let grain: Float32Array | null = null; // per-texel hash noise 0..1
  let blockShape: Float32Array | null = null; // 0..1 skeleton field
  let blockIndex: Int16Array | null = null; // which block owns the texel
  let inkText: Rgb = [128, 128, 128];
  let inkAccent: Rgb = [128, 128, 128];

  const born = performance.now() / 1000;
  let blocks: Block[] = [];
  let phaseRank = 0;
  let repair = false;
  let destroyed = false;
  let raf = 0;
  let last = 0;

  const resolveInks = () => {
    inkText = resolveInk(host, 'var(--color-text, CanvasText)', [128, 128, 128]);
    inkAccent = resolveInk(host, 'var(--color-accent, CanvasText)', inkText);
  };

  const rebuild = () => {
    const rect = host.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (w <= 1 || h <= 1) return;
    canvas.width = w;
    canvas.height = h;
    lw = Math.max(1, Math.ceil(w / TEXEL_PX));
    lh = Math.max(1, Math.ceil(h / TEXEL_PX));
    lo.width = lw;
    lo.height = lh;
    img = low.createImageData(lw, lh);
    grain = new Float32Array(lw * lh);
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) grain[y * lw + x] = hash2(x, y);
    layout();
    resolveInks();
  };

  // Lay the blocks out as an abstract skeleton: a title bar then stacked
  // rows whose heights and widths vary by node-id hash. This is deliberately
  // not the real layout — it is the ghost of *a* surface, not a preview of
  // model output.
  const layout = () => {
    if (!grain) return;
    blockShape = new Float32Array(lw * lh);
    blockIndex = new Int16Array(lw * lh).fill(-1);
    if (blocks.length === 0) return;
    const padX = Math.max(2, Math.round(lw * 0.07));
    const padY = Math.max(2, Math.round(lh * 0.12));
    const gap = Math.max(1, Math.round(lh * 0.045));
    let cursorY = padY;
    blocks.forEach((block, index) => {
      if (cursorY >= lh - padY) return;
      const seed = hashString(block.id);
      const isTitle = index === 0;
      const rowH = Math.max(
        2,
        Math.round(lh * (isTitle ? 0.13 : 0.08 + seed * 0.09)),
      );
      const rowW = Math.round((lw - padX * 2) * (isTitle ? 0.42 + seed * 0.2 : 0.62 + seed * 0.36));
      const y0 = cursorY;
      const y1 = Math.min(lh - padY, cursorY + rowH);
      const x0 = padX;
      const x1 = Math.min(lw - padX, padX + rowW);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          // Rim falloff so blocks granulate at their edges instead of ending.
          const inset = Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y);
          const shape = 0.5 + 0.5 * Math.min(1, inset / 2);
          const i = y * lw + x;
          if (shape > blockShape![i]!) {
            blockShape![i] = shape;
            blockIndex![i] = index;
          }
        }
      }
      cursorY = y1 + gap;
    });
  };

  const draw = (now: number) => {
    if (!img || !grain || !blockShape || !blockIndex) return;
    const t = now - born;
    const data = img.data;
    data.fill(0);
    const alpha = Math.round(255 * DOT_ALPHA);
    const blockCount = blocks.length;

    // Per-block condensation progress.
    const conjure = new Float32Array(Math.max(1, blockCount));
    for (let i = 0; i < blockCount; i++) {
      conjure[i] = reducedMotion
        ? 1
        : smoothstep(0, CONJURE_SECONDS, now - blocks[i]!.birth);
    }

    // Mist recedes as structure arrives and as the phase advances.
    const firstConjure = blockCount > 0 ? conjure[0]! : 0;
    const mistLevel = reducedMotion
      ? 0
      : (0.26 - Math.min(0.18, phaseRank * 0.03)) * (1 - firstConjure * 0.6);
    const breath = reducedMotion ? 1 : 0.75 + 0.25 * Math.sin(t * 1.6);
    const wispAmp = 0.3 * (1 - firstConjure) * breath;
    const bandY = reducedMotion ? -100 : ((t * SHIMMER_SPEED) % 1.4) * lh;
    const flicker = repair && !reducedMotion ? 0.5 + 0.5 * Math.sin(t * 21) : 0;

    for (let y = 0; y < lh; y++) {
      const brow = (y & 7) << 3;
      const band = Math.exp(-(((y - bandY) / 6) ** 2));
      for (let x = 0; x < lw; x++) {
        const i = y * lw + x;
        const n = grain[i]!;
        let lum = 0;
        let useAccent = false;

        // Formless mist + a central wisp while nothing has condensed yet.
        if (mistLevel > 0.02 || wispAmp > 0.02) {
          const drift = valueNoise(x * 0.07 + t * 0.35, y * 0.07 - t * 0.22);
          lum = drift * drift * mistLevel * (0.5 + n);
          if (wispAmp > 0.02) {
            const nx = x / lw - 0.5;
            const ny = y / lh - 0.44;
            const rad = (nx / 0.3) ** 2 + (ny / 0.34) ** 2;
            lum += Math.exp(-rad * 2.2) * wispAmp * (0.4 + drift);
            useAccent = n > 0.55;
          }
        }

        // Skeleton blocks condense grain-by-grain out of the mist.
        const owner = blockIndex[i]!;
        if (owner >= 0) {
          const c = conjure[owner]!;
          // Each texel joins the block when the conjure front passes its
          // grain value — granulated materialization, not a fade.
          const joined = smoothstep(n - 0.12, n + 0.12, c);
          let v = blockShape[i]! * joined * 0.85;
          if (flicker > 0) v *= 0.55 + 0.45 * (1 - flicker) + (n - 0.5) * 0.3;
          if (v > lum) {
            lum = v;
            // Accent ink while forming; settles into text ink once landed.
            useAccent = repair || c < 0.7 + n * 0.3;
          }
        }

        if (band > 0.03) lum = Math.min(1, lum + band * 0.05);
        if (lum <= 0.01 || lum <= BAYER8[brow + (x & 7)]!) continue;
        const ink = useAccent ? inkAccent : inkText;
        const j = i * 4;
        data[j] = ink[0]!;
        data[j + 1] = ink[1]!;
        data[j + 2] = ink[2]!;
        data[j + 3] = alpha;
      }
    }

    low.putImageData(img, 0, 0);
    out.imageSmoothingEnabled = false;
    out.clearRect(0, 0, canvas.width, canvas.height);
    out.drawImage(lo, 0, 0, lw, lh, 0, 0, canvas.width, canvas.height);
  };

  const loop = () => {
    if (destroyed) return;
    if (!canvas.isConnected) {
      destroy();
      return;
    }
    const now = performance.now() / 1000;
    if (now - last >= 1 / FPS) {
      last = now;
      draw(now);
    }
    raf = requestAnimationFrame(loop);
  };

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(() => {
      if (destroyed) return;
      rebuild();
      if (reducedMotion) draw(performance.now() / 1000);
    });
    resizeObserver.observe(host);
  }
  rebuild();
  if (!reducedMotion && typeof requestAnimationFrame === 'function') {
    raf = requestAnimationFrame(loop);
  } else {
    draw(performance.now() / 1000);
  }

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    if (raf) cancelAnimationFrame(raf);
    resizeObserver?.disconnect();
    canvas.remove();
  };

  return {
    update({ phaseRank: rank, nodeIds, repair: repairing }) {
      if (destroyed) return;
      phaseRank = rank;
      repair = repairing;
      const now = performance.now() / 1000;
      const known = new Map(blocks.map((block) => [block.id, block]));
      const next: Block[] = nodeIds
        .slice(0, 16)
        .map((id) => known.get(id) ?? { id, birth: now });
      const changed =
        next.length !== blocks.length || next.some((block, i) => blocks[i]?.id !== block.id);
      blocks = next;
      if (changed) layout();
      if (reducedMotion) draw(now);
    },
    destroy,
  };
}
