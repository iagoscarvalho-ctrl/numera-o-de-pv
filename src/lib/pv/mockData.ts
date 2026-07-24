import type { Face3D, Polyline } from "./types";

// UTM-like coordinates around a fictional area.
// Shared endpoints between polylines exercise the "shared node" logic.
const P = (x: number, y: number) => ({ x, y });

export const mockPolylines: Polyline[] = [
  {
    id: "q1",
    points: [P(350100, 7394500), P(350115, 7394510), P(350130, 7394520), P(350145, 7394528)],
  },
  {
    id: "q2",
    // Shares last vertex of q1 (350145, 7394528)
    points: [P(350145, 7394528), P(350160, 7394540), P(350178, 7394552)],
  },
  {
    id: "q3",
    // Shares first vertex of q1 (350100, 7394500)
    points: [P(350100, 7394500), P(350095, 7394485), P(350090, 7394470), P(350086, 7394455)],
  },
  {
    id: "q4",
    points: [P(350160, 7394540), P(350172, 7394525), P(350186, 7394512)],
  },
];

// Simple 3D face mesh covering the area (plane sloping from NE (high) to SW (low))
function zAt(x: number, y: number) {
  // base 810m, +1m per 20m east, +0.5m per 20m north
  return 810 + (x - 350086) * (1 / 20) + (y - 7394455) * (0.5 / 20);
}

export const mockFaces: Face3D[] = (() => {
  const faces: Face3D[] = [];
  const x0 = 350080,
    y0 = 7394450,
    step = 15,
    nx = 10,
    ny = 10;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const x1 = x0 + i * step;
      const y1 = y0 + j * step;
      const x2 = x1 + step;
      const y2 = y1 + step;
      const a = { x: x1, y: y1, z: zAt(x1, y1) };
      const b = { x: x2, y: y1, z: zAt(x2, y1) };
      const c = { x: x2, y: y2, z: zAt(x2, y2) };
      const d = { x: x1, y: y2, z: zAt(x1, y2) };
      faces.push({ a, b, c });
      faces.push({ a, b: c, c: d });
    }
  }
  return faces;
})();