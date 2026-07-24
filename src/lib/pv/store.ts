import { create } from "zustand";
import type { Face3D, NumerationAction, PV, Polyline, Vec2 } from "./types";
import { dist, interpolateZ, orderFromDownstream } from "./geometry";
import { mockFaces, mockPolylines } from "./mockData";
import type { ParsedDxf } from "./dxfParser";

type State = {
  // Active data actually rendered/used by the canvas (post layer-filter)
  polylines: Polyline[];
  faces: Face3D[];

  // Data source bookkeeping
  dataSource: "mock" | "dxf";
  dxfFileName: string | null;
  dxfWarnings: string[];

  // Unfiltered data straight from the last parsed DXF, kept so the layer
  // filter can be changed without re-uploading the file.
  rawPolylines: Polyline[];
  rawFaces: Face3D[];
  availablePolylineLayers: string[];
  availableFaceLayers: string[];
  selectedPolylineLayers: string[];
  selectedFaceLayers: string[];

  pvs: Record<string, PV>; // keyed by label
  counter: number; // next PV number to assign
  tolerance: number; // meters
  history: NumerationAction[];
  selectedPolylineId: string | null;
  referencePoint: Vec2 | null;
};

type Actions = {
  setTolerance: (t: number) => void;
  setCounter: (n: number) => void;
  resetAll: () => void;
  selectPolyline: (id: string | null) => void;
  setReferencePoint: (p: Vec2 | null) => void;
  applyNumeration: () => void;
  undo: () => void;
  loadData: (polylines: Polyline[], faces: Face3D[]) => void;
  loadDxf: (parsed: ParsedDxf, fileName: string) => void;
  setPolylineLayers: (layers: string[]) => void;
  setFaceLayers: (layers: string[]) => void;
  loadMockData: () => void;
};

function filterByLayer<T extends { layer?: string }>(items: T[], layers: string[]): T[] {
  if (layers.length === 0) return [];
  const set = new Set(layers);
  return items.filter((i) => set.has(i.layer ?? "0"));
}

export const usePVStore = create<State & Actions>((set, get) => ({
  polylines: mockPolylines,
  faces: mockFaces,

  dataSource: "mock",
  dxfFileName: null,
  dxfWarnings: [],

  rawPolylines: [],
  rawFaces: [],
  availablePolylineLayers: [],
  availableFaceLayers: [],
  selectedPolylineLayers: [],
  selectedFaceLayers: [],

  pvs: {},
  counter: 1,
  tolerance: 0.05,
  history: [],
  selectedPolylineId: null,
  referencePoint: null,

  setTolerance: (t) => set({ tolerance: t }),
  setCounter: (n) => set({ counter: Math.max(1, Math.floor(n)) }),
  resetAll: () => set({ pvs: {}, counter: 1, history: [], selectedPolylineId: null, referencePoint: null }),
  selectPolyline: (id) => set({ selectedPolylineId: id }),
  setReferencePoint: (p) => set({ referencePoint: p }),

  loadData: (polylines, faces) =>
    set({
      polylines,
      faces,
      dataSource: "mock",
      pvs: {},
      counter: 1,
      history: [],
      selectedPolylineId: null,
      referencePoint: null,
    }),

  loadMockData: () =>
    set({
      polylines: mockPolylines,
      faces: mockFaces,
      dataSource: "mock",
      dxfFileName: null,
      dxfWarnings: [],
      rawPolylines: [],
      rawFaces: [],
      availablePolylineLayers: [],
      availableFaceLayers: [],
      selectedPolylineLayers: [],
      selectedFaceLayers: [],
      pvs: {},
      counter: 1,
      history: [],
      selectedPolylineId: null,
      referencePoint: null,
    }),

  loadDxf: (parsed, fileName) => {
    const selectedPolylineLayers = [...parsed.polylineLayers];
    const selectedFaceLayers = [...parsed.faceLayers];
    set({
      dataSource: "dxf",
      dxfFileName: fileName,
      dxfWarnings: parsed.warnings,
      rawPolylines: parsed.polylines,
      rawFaces: parsed.faces,
      availablePolylineLayers: parsed.polylineLayers,
      availableFaceLayers: parsed.faceLayers,
      selectedPolylineLayers,
      selectedFaceLayers,
      polylines: filterByLayer(parsed.polylines, selectedPolylineLayers),
      faces: filterByLayer(parsed.faces, selectedFaceLayers),
      pvs: {},
      counter: 1,
      history: [],
      selectedPolylineId: null,
      referencePoint: null,
    });
  },

  setPolylineLayers: (layers) => {
    const { rawPolylines } = get();
    set({
      selectedPolylineLayers: layers,
      polylines: filterByLayer(rawPolylines, layers),
      // Changing which segments are in play invalidates any numeration already done.
      pvs: {},
      counter: 1,
      history: [],
      selectedPolylineId: null,
      referencePoint: null,
    });
  },

  setFaceLayers: (layers) => {
    const { rawFaces } = get();
    set({
      selectedFaceLayers: layers,
      faces: filterByLayer(rawFaces, layers),
    });
  },

  applyNumeration: () => {
    const { selectedPolylineId, referencePoint, polylines, faces, pvs, counter, tolerance } = get();
    if (!selectedPolylineId || !referencePoint) return;
    const poly = polylines.find((p) => p.id === selectedPolylineId);
    if (!poly) return;

    const ordered = orderFromDownstream(poly, referencePoint);
    const nextPvs: Record<string, PV> = { ...pvs };
    const createdLabels: string[] = [];
    const previousCounter = counter;
    let cur = counter;

    // Existing PVs list for proximity lookup
    const existing = Object.values(nextPvs);

    for (const v of ordered) {
      const found = existing.find((e) => dist({ x: e.x, y: e.y }, v) <= tolerance);
      if (found) {
        if (!found.polylineIds.includes(poly.id)) found.polylineIds.push(poly.id);
        continue;
      }
      const label = `PV${cur}`;
      const z = interpolateZ(v, faces);
      const pv: PV = {
        label,
        number: cur,
        x: v.x,
        y: v.y,
        z,
        polylineIds: [poly.id],
      };
      nextPvs[label] = pv;
      existing.push(pv);
      createdLabels.push(label);
      cur += 1;
    }

    set({
      pvs: nextPvs,
      counter: cur,
      history: [...get().history, { createdLabels, previousCounter, polylineId: poly.id }],
      referencePoint: null,
      selectedPolylineId: null,
    });
  },

  undo: () => {
    const { history, pvs, polylines } = get();
    if (history.length === 0) return;
    const last = history[history.length - 1];
    const nextPvs: Record<string, PV> = { ...pvs };
    for (const label of last.createdLabels) delete nextPvs[label];
    // Also unlink polyline from reused PVs (best-effort: if PV still exists and
    // was linked only via this action, remove the polyline id)
    for (const pv of Object.values(nextPvs)) {
      if (pv.polylineIds.includes(last.polylineId)) {
        // Only remove if we can be reasonably sure this action added it.
        // Simplest heuristic: if the polyline wasn't touched by any other kept action, unlink.
        const stillReferenced = history.slice(0, -1).some((h) => h.polylineId === last.polylineId);
        if (!stillReferenced) {
          pv.polylineIds = pv.polylineIds.filter((id) => id !== last.polylineId);
        }
      }
    }
    void polylines;
    set({
      pvs: nextPvs,
      counter: last.previousCounter,
      history: history.slice(0, -1),
    });
  },
}));
