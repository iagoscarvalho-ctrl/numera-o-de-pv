export type Vec2 = { x: number; y: number };

export type Polyline = {
  id: string;
  points: Vec2[]; // planar coordinates (E, N)
  layer?: string; // DXF layer name, when loaded from a DXF file
};

// Triangular face used to interpolate Z at any (x,y)
export type Face3D = {
  a: { x: number; y: number; z: number };
  b: { x: number; y: number; z: number };
  c: { x: number; y: number; z: number };
  layer?: string; // DXF layer name, when loaded from a DXF file
};

export type PV = {
  label: string; // e.g. "PV1"
  number: number;
  x: number; // E
  y: number; // N
  z: number; // interpolated
  polylineIds: string[]; // segments linked to this PV
};

export type NumerationAction = {
  label: string; // the single PV created by this click
  previousCounter: number;
};
