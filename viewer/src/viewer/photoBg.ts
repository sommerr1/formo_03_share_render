import {
  CanvasTexture,
  LinearFilter,
  SRGBColorSpace,
} from "three";

const MAX_EDGE = 1920;

export const PHOTO_BG_FLAG = "formoPhotoBg";

/** object-fit: contain — plane size in the same units as the view. */
export function containPlaneSize(
  viewW: number,
  viewH: number,
  imgW: number,
  imgH: number,
): { w: number; h: number } {
  if (!(viewW > 0 && viewH > 0 && imgW > 0 && imgH > 0)) {
    return { w: Math.max(viewW, 0), h: Math.max(viewH, 0) };
  }
  const viewAspect = viewW / viewH;
  const imgAspect = imgW / imgH;
  if (viewAspect > imgAspect) {
    return { w: viewH * imgAspect, h: viewH };
  }
  return { w: viewW, h: viewW / imgAspect };
}

function lumaOfCanvas(ctx: CanvasRenderingContext2D, w: number, h: number): number {
  const sample = 64;
  const tmp = document.createElement("canvas");
  tmp.width = sample;
  tmp.height = sample;
  const tctx = tmp.getContext("2d");
  if (!tctx) return 0.5;
  tctx.drawImage(ctx.canvas, 0, 0, w, h, 0, 0, sample, sample);
  const data = tctx.getImageData(0, 0, sample, sample).data;
  let sum = 0;
  const n = sample * sample;
  for (let i = 0; i < data.length; i += 4) {
    sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  }
  return sum / n;
}

function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}

async function sourceFromFile(
  file: File,
): Promise<{ width: number; height: number; draw: CanvasImageSource; close?: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        width: bmp.width,
        height: bmp.height,
        draw: bmp,
        close: () => bmp.close(),
      };
    } catch {
      try {
        const bmp = await createImageBitmap(file);
        return {
          width: bmp.width,
          height: bmp.height,
          draw: bmp,
          close: () => bmp.close(),
        };
      } catch {
        /* HTMLImage fallback */
      }
    }
  }
  const img = await loadHtmlImage(file);
  return {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    draw: img,
  };
}

export async function readPhotoFile(
  file: File,
): Promise<{ texture: CanvasTexture; url: string; luma: number }> {
  const src = await sourceFromFile(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(src.width, src.height, 1));
    const w = Math.max(1, Math.round(src.width * scale));
    const h = Math.max(1, Math.round(src.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(src.draw, 0, 0, w, h);
    const luma = lumaOfCanvas(ctx, w, h);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("jpeg"))),
        "image/jpeg",
        0.82,
      );
    });
    return { texture, url: URL.createObjectURL(blob), luma };
  } finally {
    src.close?.();
  }
}
