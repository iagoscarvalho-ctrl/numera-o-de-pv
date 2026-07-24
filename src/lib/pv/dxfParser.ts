import type { Face3D, Polyline, Vec2 } from "./types";

// Minimal, dependency-free DXF (ASCII) reader.
// Supports the entity types relevant to this tool:
//  - LWPOLYLINE, POLYLINE (+ VERTEX/SEQEND), LINE  -> network polylines (2D, X/Y only)
//  - 3DFACE                                        -> TIN / surface triangles (X/Y/Z)
//
// Known limitations (documented, not silently hidden):
//  - Arc segments inside LWPOLYLINE (bulge, code 42) are treated as straight
//    chords between vertices, not flattened into arcs.
//  - Only ASCII DXF is supported (binary DXF is not parsed).
//  - POLYFACE MESH / 3D MESH entities are not parsed, only plain 3DFACE.

export type DxfToken = { code: number; value: string };

export type DxfEntity = { type: string; pairs: DxfToken[]; layer: string };

export type ParsedDxf = {
  polylines: Polyline[]; // layer is attached via (poly as any).layer for filtering UI
  faces: Face3D[];
  polylineLayers: string[];
  faceLayers: string[];
  warnings: string[];
};

export type PolylineWithLayer = Polyline & { layer: string };

function tokenize(text: string): DxfToken[] {
  // DXF ASCII: alternating lines of group code / value.
  // Split on \n only and manually strip a trailing \r (much faster than a
  // regex split across a multi-megabyte file, which matters for dense TIN
  // exports that can reach tens of millions of lines).
  const lines = text.split("\n");
  const n = lines.length;
  const tokens: DxfToken[] = new Array(Math.floor(n / 2));
  let ti = 0;
  for (let i = 0; i + 1 < n; i += 2) {
    let codeLine = lines[i];
    if (codeLine.charCodeAt(codeLine.length - 1) === 13) codeLine = codeLine.slice(0, -1);
    const codeStr = codeLine.trim();
    if (codeStr === "") continue;
    const code = parseInt(codeStr, 10);
    if (Number.isNaN(code)) continue;
    let valueLine = lines[i + 1] !== undefined ? lines[i + 1] : "";
    if (valueLine.charCodeAt(valueLine.length - 1) === 13) valueLine = valueLine.slice(0, -1);
    tokens[ti++] = { code, value: valueLine.trim() };
  }
  tokens.length = ti;
  return tokens;
}

function getCode(pairs: DxfToken[], code: number): string | undefined {
  const found = pairs.find((p) => p.code === code);
  return found?.value;
}

function getNum(pairs: DxfToken[], code: number): number | undefined {
  const v = getCode(pairs, code);
  if (v === undefined) return undefined;
  const n = parseFloat(v);
  return Number.isNaN(n) ? undefined : n;
}

// Splits the token stream into a flat list of entities found inside the
// ENTITIES section, preserving order (important for POLYLINE -> VERTEX -> SEQEND).
function extractEntities(tokens: DxfToken[]): DxfEntity[] {
  const entities: DxfEntity[] = [];
  let inEntities = false;
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];

    if (t.code === 0 && t.value === "SECTION") {
      const name = tokens[i + 1]?.value;
      inEntities = name === "ENTITIES";
      i += 2;
      continue;
    }
    if (t.code === 0 && t.value === "ENDSEC") {
      inEntities = false;
      i += 1;
      continue;
    }
    if (inEntities && t.code === 0) {
      const type = t.value;
      const pairs: DxfToken[] = [];
      i += 1;
      while (i < tokens.length && tokens[i].code !== 0) {
        pairs.push(tokens[i]);
        i += 1;
      }
      const layer = getCode(pairs, 8) ?? "0";
      entities.push({ type, pairs, layer });
      continue;
    }
    i += 1;
  }
  return entities;
}

export function parseDxf(text: string): ParsedDxf {
  const tokens = tokenize(text);
  const entities = extractEntities(tokens);

  const polylines: PolylineWithLayer[] = [];
  const faces: Face3D[] = [];
  const polylineLayerSet = new Set<string>();
  const faceLayerSet = new Set<string>();
  const warnings: string[] = [];
  let polyCounter = 0;

  for (let idx = 0; idx < entities.length; idx++) {
    const ent = entities[idx];

    if (ent.type === "LWPOLYLINE") {
      const pts: Vec2[] = [];
      let curX: number | undefined;
      for (const p of ent.pairs) {
        if (p.code === 10) {
          curX = parseFloat(p.value);
        } else if (p.code === 20 && curX !== undefined) {
          const y = parseFloat(p.value);
          pts.push({ x: curX, y });
          curX = undefined;
        }
      }
      const flags = getNum(ent.pairs, 70);
      const closed = flags !== undefined && (flags & 1) === 1;
      if (closed && pts.length > 1) pts.push({ ...pts[0] });
      if (pts.length >= 2) {
        polylines.push({ id: `dxf-lwpoly-${polyCounter++}`, points: pts, layer: ent.layer });
        polylineLayerSet.add(ent.layer);
      }
      continue;
    }

    if (ent.type === "POLYLINE") {
      const pts: Vec2[] = [];
      let j = idx + 1;
      while (j < entities.length && entities[j].type === "VERTEX") {
        const vx = getNum(entities[j].pairs, 10);
        const vy = getNum(entities[j].pairs, 20);
        if (vx !== undefined && vy !== undefined) pts.push({ x: vx, y: vy });
        j += 1;
      }
      if (j < entities.length && entities[j].type === "SEQEND") j += 1;
      idx = j - 1; // consume VERTEX/SEQEND entities in the outer loop

      const flags = getNum(ent.pairs, 70);
      const closed = flags !== undefined && (flags & 1) === 1;
      if (closed && pts.length > 1) pts.push({ ...pts[0] });
      if (pts.length >= 2) {
        polylines.push({ id: `dxf-poly-${polyCounter++}`, points: pts, layer: ent.layer });
        polylineLayerSet.add(ent.layer);
      }
      continue;
    }

    if (ent.type === "LINE") {
      const x1 = getNum(ent.pairs, 10);
      const y1 = getNum(ent.pairs, 20);
      const x2 = getNum(ent.pairs, 11);
      const y2 = getNum(ent.pairs, 21);
      if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
        polylines.push({
          id: `dxf-line-${polyCounter++}`,
          points: [
            { x: x1, y: y1 },
            { x: x2, y: y2 },
          ],
          layer: ent.layer,
        });
        polylineLayerSet.add(ent.layer);
      }
      continue;
    }

    if (ent.type === "3DFACE") {
      const p1 = { x: getNum(ent.pairs, 10), y: getNum(ent.pairs, 20), z: getNum(ent.pairs, 30) };
      const p2 = { x: getNum(ent.pairs, 11), y: getNum(ent.pairs, 21), z: getNum(ent.pairs, 31) };
      const p3 = { x: getNum(ent.pairs, 12), y: getNum(ent.pairs, 22), z: getNum(ent.pairs, 32) };
      const p4x = getNum(ent.pairs, 13);
      const p4y = getNum(ent.pairs, 23);
      const p4z = getNum(ent.pairs, 33);

      const complete = (p: { x?: number; y?: number; z?: number }) =>
        p.x !== undefined && p.y !== undefined && p.z !== undefined;

      if (complete(p1) && complete(p2) && complete(p3)) {
        const a = p1 as { x: number; y: number; z: number };
        const b = p2 as { x: number; y: number; z: number };
        const c = p3 as { x: number; y: number; z: number };
        faces.push({ a, b, c, layer: ent.layer });
        faceLayerSet.add(ent.layer);

        if (p4x !== undefined && p4y !== undefined && p4z !== undefined) {
          const isDupOfP3 =
            Math.abs(p4x - c.x) < 1e-9 && Math.abs(p4y - c.y) < 1e-9 && Math.abs(p4z - c.z) < 1e-9;
          if (!isDupOfP3) {
            faces.push({ a, b: c, c: { x: p4x, y: p4y, z: p4z }, layer: ent.layer });
          }
        }
      }
      continue;
    }
  }

  if (polylines.length === 0) {
    warnings.push(
      "Nenhuma polyline de rede encontrada (procurei por LWPOLYLINE, POLYLINE e LINE). Verifique se a rede foi exportada nessas entidades.",
    );
  }
  if (faces.length === 0) {
    warnings.push(
      "Nenhuma face 3D encontrada (procurei por entidades 3DFACE). Sem faces, a cota (Z) não pode ser interpolada — verifique se a superfície/TIN foi exportada como 3DFACE no DXF.",
    );
  }

  return {
    polylines,
    faces,
    polylineLayers: Array.from(polylineLayerSet).sort(),
    faceLayers: Array.from(faceLayerSet).sort(),
    warnings,
  };
}
