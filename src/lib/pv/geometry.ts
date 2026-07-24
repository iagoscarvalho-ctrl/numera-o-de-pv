import type { Face3D, Polyline, Vec2 } from "./types";

export const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

// Distance from point p to segment ab, returns { d, t } where t is projection [0,1]
export function distToSegment(p: Vec2, a: Vec2, b: Vec2) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { d: dist(p, a), t: 0 };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: a.x + t * dx, y: a.y + t * dy };
  return { d: dist(p, proj), t };
}

export function distToPolyline(p: Vec2, poly: Polyline) {
  let best = Infinity;
  for (let i = 0; i < poly.points.length - 1; i++) {
    const { d } = distToSegment(p, poly.points[i], poly.points[i + 1]);
    if (d < best) best = d;
  }
  return best;
}

// Finds the closest vertex, across all given polylines, to the click point
// `p`, as long as it's within `maxDist` (already converted to world units by
// the caller, since it depends on the current zoom level). Returns null if
// nothing is close enough — i.e. the user clicked empty space.
export function findNearestVertex(polylines: Polyline[], p: Vec2, maxDist: number): Vec2 | null {
  let best: { v: Vec2; d: number } | null = null;
  for (const poly of polylines) {
    for (const v of poly.points) {
      const d = dist(p, v);
      if (d <= maxDist && (!best || d < best.d)) best = { v, d };
    }
  }
  return best ? best.v : null;
}

// Which polylines have a vertex within `tolerance` of `v` — i.e. which
// segments physically meet at this node. Used to keep the PV's segment
// links up to date even though numbering is now a single click per node.
export function polylinesAtVertex(polylines: Polyline[], v: Vec2, tolerance: number): string[] {
  const ids: string[] = [];
  for (const poly of polylines) {
    if (poly.points.some((pt) => dist(pt, v) <= tolerance)) ids.push(poly.id);
  }
  return ids;
}

// Barycentric interpolation of Z over a triangular face
function interpTriangle(p: Vec2, f: Face3D): number | null {
  const { a, b, c } = f;
  const denom = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (denom === 0) return null;
  const l1 = ((b.y - c.y) * (p.x - c.x) + (c.x - b.x) * (p.y - c.y)) / denom;
  const l2 = ((c.y - a.y) * (p.x - c.x) + (a.x - c.x) * (p.y - c.y)) / denom;
  const l3 = 1 - l1 - l2;
  const eps = 1e-6;
  if (l1 < -eps || l2 < -eps || l3 < -eps) return null;
  return l1 * a.z + l2 * b.z + l3 * c.z;
}

export function interpolateZ(p: Vec2, faces: Face3D[]): number {
  for (const f of faces) {
    const z = interpTriangle(p, f);
    if (z !== null) return z;
  }
  // Fallback: nearest vertex Z
  let best = Infinity;
  let bestZ = 0;
  for (const f of faces) {
    for (const v of [f.a, f.b, f.c]) {
      const d = Math.hypot(v.x - p.x, v.y - p.y);
      if (d < best) {
        best = d;
        bestZ = v.z;
      }
    }
  }
  return bestZ;
}
