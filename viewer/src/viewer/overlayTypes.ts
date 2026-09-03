export const FORMO_FACADES_GROUP = "formo_facades";
export const FORMO_BODY_GROUP = "formo_body";
export const FORMO_FILLERS_GROUP = "formo_fillers";

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
    withFacadesNoFillers?: StudioDim[];
    withoutFacadesNoFillers?: StudioDim[];
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
  const dims = o.dims as ShareOverlayV1["dims"] & Record<string, unknown>;
  const extra: Partial<ShareOverlayV1["dims"]> = {};
  if (Array.isArray(dims.withFacadesNoFillers)) {
    extra.withFacadesNoFillers = dims.withFacadesNoFillers as StudioDim[];
  }
  if (Array.isArray(dims.withoutFacadesNoFillers)) {
    extra.withoutFacadesNoFillers = dims.withoutFacadesNoFillers as StudioDim[];
  }
  return {
    schemaVersion: 1,
    units: "meters",
    dims: { ...o.dims, ...extra },
    actors: o.actors,
  };
}

export function pickOverlayDims(
  overlay: ShareOverlayV1,
  showFacades: boolean,
  showFillers: boolean,
): StudioDim[] {
  if (showFillers) {
    return showFacades ? overlay.dims.withFacades : overlay.dims.withoutFacades;
  }
  const no = showFacades
    ? overlay.dims.withFacadesNoFillers
    : overlay.dims.withoutFacadesNoFillers;
  if (no && no.length > 0) return no;
  return showFacades ? overlay.dims.withFacades : overlay.dims.withoutFacades;
}
