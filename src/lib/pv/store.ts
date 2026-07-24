import { create } from "zustand";
import type { Face3D, NumerationAction, PV, Polyline, Vec2 } from "./types";
import { dist, findNearestVertex, interpolateZ, polylinesAtVertex } from "./geometry";
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
  tolerance: number; // meters — radius used to recognize "this is the same node"
  history: NumerationAction[];
  lastMessage: string | null; // feedback for the last click (created / already numbered / missed)
};

type Actions = {
  setTolerance: (t: number) => void;
  setCounter: (n: number) => void;
  resetAll: () => void;
  clickVertex: (worldPoint: Vec2, maxClickDist: number) => void;
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

const emptyNumerationState = {
  pvs: {} as Record<string, PV>,
  counter: 1,
  history: [] as NumerationAction[],
  lastMessage: null as string | null,
};

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

  tolerance: 0.05,
  ...emptyNumerationState,

  setTolerance: (t) => set({ tolerance: t }),
  setCounter: (n) => set({ counter: Math.max(1, Math.floor(n)) }),
  resetAll: () => set({ ...emptyNumerationState }),

  loadData: (polylines, faces) =>
    set({
      polylines,
      faces,
      dataSource: "mock",
      ...emptyNumerationState,
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
      ...emptyNumerationState,
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
      ...emptyNumerationState,
    });
  },

  setPolylineLayers: (layers) => {
    const { rawPolylines } = get();
    set({
      selectedPolylineLayers: layers,
      polylines: filterByLayer(rawPolylines, layers),
      // Changing which segments are in play invalidates any numeration already done.
      ...emptyNumerationState,
    });
  },

  setFaceLayers: (layers) => {
    const { rawFaces } = get();
    set({
      selectedFaceLayers: layers,
      faces: filterByLayer(rawFaces, layers),
    });
  },

  // Called on every canvas click. Finds the nearest vertex to the click
  // (within `maxClickDist`, a pixel-derived threshold converted to world
  // units by the caller) and, if it isn't already numbered, assigns it the
  // next sequential PV number. The order PVs get numbered in is exactly the
  // order the user clicks vertices — no automatic ordering by quadra,
  // elevation, or click-reference direction anymore.
  clickVertex: (worldPoint, maxClickDist) => {
    const { polylines, faces, pvs, counter, tolerance } = get();

    const hit = findNearestVertex(polylines, worldPoint, maxClickDist);
    if (!hit) {
      set({ lastMessage: "Nenhum vértice encontrado perto do clique — tente dar mais zoom." });
      return;
    }

    const already = Object.values(pvs).find((pv) => dist({ x: pv.x, y: pv.y }, hit) <= tolerance);
    if (already) {
      set({ lastMessage: `Esse nó já está numerado como ${already.label}.` });
      return;
    }

    const label = `PV${counter}`;
    const z = interpolateZ(hit, faces);
    const polylineIds = polylinesAtVertex(polylines, hit, tolerance);
    const pv: PV = { label, number: counter, x: hit.x, y: hit.y, z, polylineIds };

    set({
      pvs: { ...pvs, [label]: pv },
      counter: counter + 1,
      history: [...get().history, { label, previousCounter: counter }],
      lastMessage: `${label} criado.`,
    });
  },

  undo: () => {
    const { history, pvs } = get();
    if (history.length === 0) return;
    const last = history[history.length - 1];
    const nextPvs: Record<string, PV> = { ...pvs };
    delete nextPvs[last.label];
    set({
      pvs: nextPvs,
      counter: last.previousCounter,
      history: history.slice(0, -1),
      lastMessage: `${last.label} desfeito.`,
    });
  },
}));
