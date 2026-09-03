const MAX_EDGE = 1920;

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

export async function readPhotoFile(
  file: File,
): Promise<{ url: string; luma: number }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height, 1));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bmp.close();
    throw new Error("canvas");
  }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const luma = lumaOfCanvas(ctx, w, h);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("jpeg"))),
      "image/jpeg",
      0.82,
    );
  });
  return { url: URL.createObjectURL(blob), luma };
}
