const MIN_FONT_PX = 18;
const DIM_LABEL_BOOST = 1.6;

function parseCssPx(value: string, fallback: number): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Paint `.share-dim` HTML labels onto a bitmap (WebGL lines are already drawn). */
export function compositeShareDimLabels(
  ctx: CanvasRenderingContext2D,
  glCanvas: HTMLCanvasElement,
  outputWidth: number,
  outputHeight: number,
): void {
  const canvasRect = glCanvas.getBoundingClientRect();
  if (canvasRect.width <= 0 || canvasRect.height <= 0) return;

  const pxScaleX = outputWidth / canvasRect.width;
  const pxScaleY = outputHeight / canvasRect.height;
  const dimElements = Array.from(
    document.querySelectorAll<HTMLElement>(".share-dim"),
  );

  for (const el of dimElements) {
    const rect = el.getBoundingClientRect();
    const x = (rect.left - canvasRect.left) * pxScaleX;
    const y = (rect.top - canvasRect.top) * pxScaleY;
    const w = rect.width * pxScaleX;
    const h = rect.height * pxScaleY;
    const text = el.innerText.trim();
    if (!text || w <= 0 || h <= 0) continue;

    const computed = getComputedStyle(el);
    const cssFontPx = parseCssPx(computed.fontSize, 11);
    const fontPx = Math.max(MIN_FONT_PX, cssFontPx * pxScaleX * DIM_LABEL_BOOST);
    const padX = Math.max(4, 5 * pxScaleX * DIM_LABEL_BOOST);
    const padY = Math.max(2, 3 * pxScaleY * DIM_LABEL_BOOST);

    ctx.fillStyle = computed.backgroundColor || "rgba(18, 22, 30, 0.88)";
    ctx.fillRect(x - padX * 0.2, y - padY * 0.2, w + padX * 0.4, h + padY * 0.4);

    ctx.lineWidth = Math.max(1, 1 * pxScaleX * DIM_LABEL_BOOST);
    ctx.strokeStyle = el.classList.contains("share-dim--zone")
      ? "#fbbf24"
      : el.classList.contains("share-dim--facade")
        ? "#fb923c"
        : "#94a3b8";
    ctx.strokeRect(x, y, w, h);

    ctx.font = `600 ${fontPx}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = el.classList.contains("share-dim--zone")
      ? "#fde68a"
      : el.classList.contains("share-dim--facade")
        ? "#fdba74"
        : "#f1f5f9";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + w / 2, y + h / 2);
  }
}
