export const FORMO_FACADES_GROUP = "formo_facades";
export const FORMO_BODY_GROUP = "formo_body";

export type Vec3T = [number, number, number];
export type Vec3O = { x: number; y: number; z: number };
export type CornerId = "tl" | "tr" | "bl" | "br";

export type StudioDim = {
  id: string;
  kind: "carcass" | "zone" | "facade";
  axis: "w" | "h" | "d";
  valueMm: number;
  a: Vec3T;
  b: Vec3T;
  extA: [Vec3T, Vec3T];
  extB: [Vec3T, Vec3T];
  label: Vec3T;
};

export type FacadeActor = {
  kind: "facade";
  id: string;
  partId: string;
  hinge: "left" | "right";
  pivot: Vec3O;
  center: Vec3O;
  size: Vec3O;
  signedAngle: number;
  openCorners: CornerId[];
  closeCorners: CornerId[];
};

export type DrawerActor = {
  kind: "drawer";
  id: string;
  partIds: string[];
  hitPartId: string;
  center: Vec3O;
  size: Vec3O;
  travelZ: number;
};

export type AnimActor = FacadeActor | DrawerActor;

export type ShareOverlayV1 = {
  schemaVersion: 1;
  units: "meters";
  dims: {
    withFacades: StudioDim[];
    withoutFacades: StudioDim[];
  };
  actors: AnimActor[];
};

export function parseShareOverlay(data: unknown): ShareOverlayV1 | null {
  if (!data || typeof data !== "object") return null;
  const o = data as ShareOverlayV1;
  if (o.schemaVersion !== 1 || o.units !== "meters") return null;
  if (!o.dims || !Array.isArray(o.dims.withFacades) || !Array.isArray(o.dims.withoutFacades)) {
    return null;
  }
  if (!Array.isArray(o.actors)) return null;
  return o;
}
