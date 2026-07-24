export type Vec2 = { x: number; y: number };

export type Polyline = {
  id: string;
  points: Vec2[]; // planar coordinates (E, N)
};

// Triangular face used to interpolate Z at any (x,y)
export type Face3D = {
  a: { x: number; y: number; z: number };
  b: { x: number; y: number; z: number };
  c: { x: number; y: number; z: number };
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
  createdLabels: string[]; // PVs created by this action (reusable ones excluded)
  previousCounter: number;
  polylineId: string;
};