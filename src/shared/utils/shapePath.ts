// Self-contained shape path utilities — types + math for the 'shape' component.
//
// DUPLICATED FILE — this exact file exists in BOTH projects (there is no real
// shared module between the builder and the TV app; "shared" files are copies):
//   layout-builder-web/src/shared/utils/shapePath.ts   <- source of truth (has tests)
//   src/utils/shapePath.ts                              <- TV app copy
// If you edit one, copy the whole file to the other.

export interface VertexHandle {
  x: number;
  y: number;
}

export interface Vertex {
  x: number; // normalized 0–1 within the component's bounding box
  y: number;
  type: 'corner' | 'smooth' | 'broken';
  hIn?: VertexHandle;  // bezier handle offsets, normalized, relative to the vertex
  hOut?: VertexHandle;
}

export interface ShapeData {
  closed: boolean;
  vertices: Vertex[];
  pathData?: string; // baked at export time only; pixel coordinates
}

export interface GradientStop {
  offset: number; // 0–1
  color: string; // also the fallback when teamColor is set but game data is missing
  teamColor?: 'home' | 'away'; // resolve from live team colors at render time
}

export interface ShapeGradient {
  type: 'linear' | 'radial';
  angle: number; // degrees; linear only
  stops: GradientStop[];
}

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** "1f2a3b" -> "#1f2a3b" (TV game data sends team colors without '#'); otherwise passthrough. */
export function normalizeColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  if (/^[0-9a-fA-F]{6}$/.test(color)) return `#${color}`;
  return color;
}

const fallbackRect = (width: number, height: number): string =>
  `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`;

/** Generate an SVG path "d" string in pixel space from normalized vertices. */
export function generatePath(
  vertices: Vertex[],
  closed: boolean,
  width: number,
  height: number
): string {
  if (!Array.isArray(vertices) || vertices.length < 2) {
    return fallbackRect(width, height);
  }
  const px = (p: { x: number; y: number }): string =>
    `${round2(num(p.x, 0) * width)} ${round2(num(p.y, 0) * height)}`;

  const parts: string[] = [`M ${px(vertices[0])}`];
  const n = vertices.length;
  const segCount = closed ? n : n - 1;
  for (let i = 0; i < segCount; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    const isWrap = closed && i === n - 1;
    if (a.hOut || b.hIn) {
      const c1 = { x: num(a.x, 0) + num(a.hOut?.x, 0), y: num(a.y, 0) + num(a.hOut?.y, 0) };
      const c2 = { x: num(b.x, 0) + num(b.hIn?.x, 0), y: num(b.y, 0) + num(b.hIn?.y, 0) };
      parts.push(`C ${px(c1)}, ${px(c2)}, ${px(b)}`);
    } else if (!isWrap) {
      // Straight wrap segment is omitted; Z closes the contour implicitly.
      parts.push(`L ${px(b)}`);
    }
  }
  if (closed) parts.push('Z');
  return parts.join(' ');
}

interface Point {
  x: number;
  y: number;
}

const lerp = (u: Point, v: Point, t: number): Point => ({
  x: u.x + (v.x - u.x) * t,
  y: u.y + (v.y - u.y) * t,
});

const segmentControlPoints = (a: Vertex, b: Vertex): [Point, Point, Point, Point] => {
  const p0 = { x: num(a.x, 0), y: num(a.y, 0) };
  const p3 = { x: num(b.x, 0), y: num(b.y, 0) };
  const p1 = { x: p0.x + num(a.hOut?.x, 0), y: p0.y + num(a.hOut?.y, 0) };
  const p2 = { x: p3.x + num(b.hIn?.x, 0), y: p3.y + num(b.hIn?.y, 0) };
  return [p0, p1, p2, p3];
};

const isCurved = (a: Vertex, b: Vertex): boolean => Boolean(a.hOut || b.hIn);

/** Evaluate the segment a->b at parameter t (normalized space). */
export function evalSegment(a: Vertex, b: Vertex, t: number): Point {
  if (!isCurved(a, b)) {
    return lerp({ x: a.x, y: a.y }, { x: b.x, y: b.y }, t);
  }
  const [p0, p1, p2, p3] = segmentControlPoints(a, b);
  const q0 = lerp(p0, p1, t);
  const q1 = lerp(p1, p2, t);
  const q2 = lerp(p2, p3, t);
  const r0 = lerp(q0, q1, t);
  const r1 = lerp(q1, q2, t);
  return lerp(r0, r1, t);
}

/** Nearest t on segment a->b to a point, by sampling (good enough for hit-testing). */
export function closestTOnSegment(a: Vertex, b: Vertex, point: Point, samples = 64): number {
  let bestT = 0;
  let bestD = Infinity;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = evalSegment(a, b, t);
    const d = (p.x - point.x) ** 2 + (p.y - point.y) ** 2;
    if (d < bestD) {
      bestD = d;
      bestT = t;
    }
  }
  return bestT;
}

/**
 * Insert a vertex on segment segIndex (between vertices[segIndex] and the next,
 * wrapping for closed shapes) at parameter t. Curve shape is preserved via
 * de Casteljau splitting. Returns a NEW vertices array.
 */
export function insertVertexOnSegment(
  vertices: Vertex[],
  _closed: boolean,
  segIndex: number,
  t: number
): Vertex[] {
  const n = vertices.length;
  const a = vertices[segIndex];
  const b = vertices[(segIndex + 1) % n];
  let newA = a;
  let newB = b;
  let newVertex: Vertex;

  if (isCurved(a, b)) {
    const [p0, p1, p2, p3] = segmentControlPoints(a, b);
    const q0 = lerp(p0, p1, t);
    const q1 = lerp(p1, p2, t);
    const q2 = lerp(p2, p3, t);
    const r0 = lerp(q0, q1, t);
    const r1 = lerp(q1, q2, t);
    const s = lerp(r0, r1, t);
    newA = { ...a, hOut: { x: q0.x - p0.x, y: q0.y - p0.y } };
    newB = { ...b, hIn: { x: q2.x - p3.x, y: q2.y - p3.y } };
    newVertex = {
      x: s.x,
      y: s.y,
      type: 'broken',
      hIn: { x: r0.x - s.x, y: r0.y - s.y },
      hOut: { x: r1.x - s.x, y: r1.y - s.y },
    };
  } else {
    const p = lerp({ x: a.x, y: a.y }, { x: b.x, y: b.y }, t);
    newVertex = { x: p.x, y: p.y, type: 'corner' };
  }

  const out = [...vertices];
  out[segIndex] = newA;
  out[(segIndex + 1) % n] = newB;
  out.splice(segIndex + 1, 0, newVertex);
  return out;
}

export interface ShapeBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Tight bounding box (normalized units) including bezier extrema. */
export function getShapeBounds(vertices: Vertex[], closed: boolean): ShapeBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const include = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const v of vertices) include(num(v.x, 0), num(v.y, 0));

  const segCount = closed ? vertices.length : vertices.length - 1;
  for (let i = 0; i < segCount; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    if (!isCurved(a, b)) continue;
    const [p0, p1, p2, p3] = segmentControlPoints(a, b);
    for (const axis of ['x', 'y'] as const) {
      // B'(t) coefficients: at^2 + bt + c with
      const ca = 3 * (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]);
      const cb = 6 * (p0[axis] - 2 * p1[axis] + p2[axis]);
      const cc = 3 * (p1[axis] - p0[axis]);
      const roots: number[] = [];
      if (Math.abs(ca) < 1e-9) {
        if (Math.abs(cb) > 1e-9) roots.push(-cc / cb);
      } else {
        const disc = cb * cb - 4 * ca * cc;
        if (disc >= 0) {
          const sq = Math.sqrt(disc);
          roots.push((-cb + sq) / (2 * ca), (-cb - sq) / (2 * ca));
        }
      }
      for (const t of roots) {
        if (t > 0 && t < 1) {
          const p = evalSegment(a, b, t);
          include(p.x, p.y);
        }
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Recompute position/size so the component tightly encloses its shape, and
 * re-normalize vertices so nothing moves on screen. Returns null when the
 * shape already fills its bounds (within epsilon).
 */
export function refitShapeGeometry(
  shape: { closed: boolean; vertices: Vertex[] },
  position: Point,
  size: { width: number; height: number }
): { position: Point; size: { width: number; height: number }; shape: ShapeData } | null {
  if (!Array.isArray(shape.vertices) || shape.vertices.length < 2) return null;
  const b = getShapeBounds(shape.vertices, shape.closed);
  const eps = 1e-4;
  if (
    Math.abs(b.minX) < eps && Math.abs(b.minY) < eps &&
    Math.abs(b.maxX - 1) < eps && Math.abs(b.maxY - 1) < eps
  ) {
    return null;
  }
  const newW = Math.max(1, (b.maxX - b.minX) * size.width);
  const newH = Math.max(1, (b.maxY - b.minY) * size.height);
  const sx = size.width / newW;
  const sy = size.height / newH;
  const remapHandle = (h: VertexHandle | undefined): VertexHandle | undefined =>
    h ? { x: h.x * sx, y: h.y * sy } : undefined;
  const vertices: Vertex[] = shape.vertices.map(v => {
    const out: Vertex = {
      x: (num(v.x, 0) - b.minX) * sx,
      y: (num(v.y, 0) - b.minY) * sy,
      type: v.type,
    };
    const hIn = remapHandle(v.hIn);
    const hOut = remapHandle(v.hOut);
    if (hIn) out.hIn = hIn;
    if (hOut) out.hOut = hOut;
    return out;
  });
  return {
    position: { x: position.x + b.minX * size.width, y: position.y + b.minY * size.height },
    size: { width: newW, height: newH },
    shape: { closed: shape.closed, vertices },
  };
}

/**
 * Validate + sanitize shape data for export. Returns null for degenerate shapes.
 * A missing `closed` field defaults to true — only an explicit `closed: false`
 * (the line/open-path case) keeps a path open.
 */
export function clampShapeData(shape: unknown): ShapeData | null {
  const s = shape as { closed?: unknown; vertices?: unknown } | null;
  if (!s || !Array.isArray(s.vertices)) return null;
  const closed = s.closed !== false;
  const vertices: Vertex[] = (s.vertices as unknown[])
    .filter((v): v is Record<string, unknown> => {
      const c = v as Record<string, unknown> | null;
      return Boolean(c && Number.isFinite(c.x) && Number.isFinite(c.y));
    })
    .map(v => {
      const type = v.type === 'smooth' || v.type === 'broken' ? (v.type as Vertex['type']) : 'corner';
      const out: Vertex = { x: clamp(v.x as number, 0, 1), y: clamp(v.y as number, 0, 1), type };
      if (type !== 'corner') {
        const hIn = v.hIn as VertexHandle | undefined;
        const hOut = v.hOut as VertexHandle | undefined;
        if (hIn && Number.isFinite(hIn.x) && Number.isFinite(hIn.y)) {
          out.hIn = { x: clamp(hIn.x, -2, 2), y: clamp(hIn.y, -2, 2) };
        }
        if (hOut && Number.isFinite(hOut.x) && Number.isFinite(hOut.y)) {
          out.hOut = { x: clamp(hOut.x, -2, 2), y: clamp(hOut.y, -2, 2) };
        }
      }
      return out;
    });
  if (vertices.length < (closed ? 3 : 2)) return null;
  return { closed, vertices };
}

/** Validate a gradient prop. Returns null when unusable (renderers then fall back to solid). */
export function sanitizeGradient(g: unknown): ShapeGradient | null {
  const grad = g as { type?: unknown; angle?: unknown; stops?: unknown } | null;
  if (!grad || !Array.isArray(grad.stops)) return null;
  const stops = (grad.stops as unknown[])
    .filter((st): st is { offset?: unknown; color: string; teamColor?: unknown } =>
      Boolean(st && typeof (st as Record<string, unknown>).color === 'string'))
    .map(st => {
      const stop: GradientStop = { offset: clamp(num(st.offset, 0), 0, 1), color: st.color };
      if (st.teamColor === 'home' || st.teamColor === 'away') stop.teamColor = st.teamColor;
      return stop;
    })
    .sort((a, b) => a.offset - b.offset);
  if (stops.length < 2) return null;
  return { type: grad.type === 'radial' ? 'radial' : 'linear', angle: num(grad.angle, 0), stops };
}

/**
 * Resolve a gradient stop's render color. Team-bound stops use the live game
 * color for their side, falling back to the stop's stored color when the game
 * color is unavailable.
 */
export function resolveStopColor(
  stop: GradientStop,
  homeColor: string | undefined,
  awayColor: string | undefined
): string {
  if (stop.teamColor) {
    const team = stop.teamColor === 'away' ? awayColor : homeColor;
    if (team) return normalizeColor(team, stop.color || '#000000');
  }
  return normalizeColor(stop.color, '#000000');
}

/** Linear-gradient endpoints (objectBoundingBox units) for an angle in degrees. 0deg = left->right. */
export function gradientCoords(angle: number): { x1: number; y1: number; x2: number; y2: number } {
  const rad = (num(angle, 0) * Math.PI) / 180;
  const dx = Math.cos(rad) / 2;
  const dy = Math.sin(rad) / 2;
  return { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy };
}
