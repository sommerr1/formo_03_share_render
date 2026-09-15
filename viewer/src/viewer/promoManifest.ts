export type ShareMode = "survey" | "promo";

export interface PromoFrameTextOverlay {
  text: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  borderColor?: string;
  backgroundColor?: string;
  position?: { xPercent: number; yPercent: number };
}

export interface PromoViewFrame {
  id: string;
  order: number;
  title?: string;
  imageDataUrl: string;
  overlayText?: PromoFrameTextOverlay;
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    fov?: number;
  };
}

export interface PromoManifest {
  frames: PromoViewFrame[];
  allow3D: boolean;
  backgroundImageUrl?: string;
  autoPlay?: boolean;
  relatedTokens?: string[];
}

export function parsePromoManifest(json: unknown): PromoManifest | null {
  if (!json || typeof json !== "object") return null;
  const raw = json as Partial<PromoManifest>;
  if (!Array.isArray(raw.frames)) return null;
  return {
    frames: raw.frames.map((f, idx) => ({
      id: typeof f?.id === "string" ? f.id : `frame_${idx}_${Date.now()}`,
      order: typeof f?.order === "number" ? f.order : idx,
      title: typeof f?.title === "string" ? f.title : undefined,
      imageDataUrl: typeof f?.imageDataUrl === "string" ? f.imageDataUrl : "",
      overlayText:
        f?.overlayText && typeof f.overlayText === "object"
          ? {
              text: String(f.overlayText.text ?? ""),
              fontFamily:
                typeof f.overlayText.fontFamily === "string"
                  ? f.overlayText.fontFamily
                  : undefined,
              fontSize:
                typeof f.overlayText.fontSize === "number"
                  ? f.overlayText.fontSize
                  : undefined,
              color:
                typeof f.overlayText.color === "string"
                  ? f.overlayText.color
                  : undefined,
              borderColor:
                typeof f.overlayText.borderColor === "string"
                  ? f.overlayText.borderColor
                  : undefined,
              backgroundColor:
                typeof f.overlayText.backgroundColor === "string"
                  ? f.overlayText.backgroundColor
                  : undefined,
              position:
                f.overlayText.position &&
                typeof f.overlayText.position === "object"
                  ? {
                      xPercent:
                        typeof f.overlayText.position.xPercent === "number"
                          ? f.overlayText.position.xPercent
                          : 50,
                      yPercent:
                        typeof f.overlayText.position.yPercent === "number"
                          ? f.overlayText.position.yPercent
                          : 80,
                    }
                  : undefined,
            }
          : undefined,
      camera: {
        position:
          Array.isArray(f?.camera?.position) && f.camera.position.length === 3
            ? [
                Number(f.camera.position[0]),
                Number(f.camera.position[1]),
                Number(f.camera.position[2]),
              ]
            : [0, 1000, 2500],
        target:
          Array.isArray(f?.camera?.target) && f.camera.target.length === 3
            ? [
                Number(f.camera.target[0]),
                Number(f.camera.target[1]),
                Number(f.camera.target[2]),
              ]
            : [0, 1000, 0],
        fov: typeof f?.camera?.fov === "number" ? f.camera.fov : 50,
      },
    })),
    allow3D: raw.allow3D !== false,
    backgroundImageUrl:
      typeof raw.backgroundImageUrl === "string"
        ? raw.backgroundImageUrl
        : undefined,
    autoPlay: Boolean(raw.autoPlay),
    relatedTokens: Array.isArray(raw.relatedTokens)
      ? raw.relatedTokens.filter((t): t is string => typeof t === "string" && Boolean(t))
      : undefined,
  };
}
