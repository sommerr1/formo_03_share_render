import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { AnnotateOp } from "./surveyDraft.js";

export type AnnotateTool = "pen" | "text" | "erase";

export type AnnotateLayerHandle = {
  canvas: () => HTMLCanvasElement | null;
};

type Props = {
  ops: AnnotateOp[];
  onChange: (ops: AnnotateOp[]) => void;
  tool: AnnotateTool;
  capturing: boolean;
  visible: boolean;
};

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function hitOp(
  op: AnnotateOp,
  p: { x: number; y: number },
  minSide: number,
): boolean {
  if (op.kind === "text" || op.kind === "symbol") {
    return dist(p, op) < 28 / minSide;
  }
  const thresh = Math.max(op.width * 2, 10 / minSide);
  for (let i = 1; i < op.points.length; i++) {
    const a = op.points[i - 1];
    const b = op.points[i];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = p.x - a.x;
    const apy = p.y - a.y;
    const ab2 = abx * abx + aby * aby;
    const t = ab2 === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
    const cx = a.x + abx * t;
    const cy = a.y + aby * t;
    if (dist(p, { x: cx, y: cy }) <= thresh) return true;
  }
  return op.points.some((q) => dist(p, q) <= thresh);
}

function drawOps(
  ctx: CanvasRenderingContext2D,
  ops: AnnotateOp[],
  w: number,
  h: number,
): void {
  const minSide = Math.min(w, h);
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#ff3b30";
  ctx.fillStyle = "#ff3b30";
  for (const op of ops) {
    if (op.kind === "stroke") {
      if (op.points.length < 1) continue;
      ctx.beginPath();
      ctx.lineWidth = Math.max(2, op.width * minSide);
      ctx.moveTo(op.points[0].x * w, op.points[0].y * h);
      for (let i = 1; i < op.points.length; i++) {
        ctx.lineTo(op.points[i].x * w, op.points[i].y * h);
      }
      ctx.stroke();
    } else if (op.kind === "text") {
      ctx.font = `600 ${Math.max(16, minSide * 0.032)}px system-ui, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(op.text, op.x * w, op.y * h);
    } else {
      ctx.font = `700 ${Math.max(22, minSide * 0.045)}px system-ui, sans-serif`;
      ctx.fillText(op.glyph, op.x * w, op.y * h);
    }
  }
}

export const AnnotateLayer = forwardRef<AnnotateLayerHandle, Props>(
  function AnnotateLayer({ ops, onChange, tool, capturing, visible }, ref) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const opsRef = useRef(ops);
    opsRef.current = ops;
    const drawing = useRef<Array<{ x: number; y: number }> | null>(null);
    const [edit, setEdit] = useState<{ x: number; y: number; value: string } | null>(
      null,
    );
    const editRef = useRef(edit);
    editRef.current = edit;
    const inputRef = useRef<HTMLInputElement>(null);
    const placedAt = useRef(0);

    useImperativeHandle(ref, () => ({
      canvas: () => canvasRef.current,
    }));

    const paint = () => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawOps(ctx, opsRef.current, rect.width, rect.height);
    };

    useEffect(() => {
      paint();
    }, [ops]);

    useEffect(() => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const ro = new ResizeObserver(() => paint());
      ro.observe(wrap);
      return () => ro.disconnect();
    }, []);

    const norm = (e: ReactPointerEvent): { x: number; y: number } => {
      const wrap = wrapRef.current!;
      const r = wrap.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) / r.width,
        y: (e.clientY - r.top) / r.height,
      };
    };

    const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!capturing) return;
      if (tool === "text") {
        e.preventDefault();
        e.stopPropagation();
        const p = norm(e);
        placedAt.current = Date.now();
        setEdit({ x: p.x, y: p.y, value: "" });
        return;
      }
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const p = norm(e);
      if (tool === "pen") {
        drawing.current = [p];
        return;
      }
      const wrap = wrapRef.current!;
      const minSide = Math.min(wrap.clientWidth, wrap.clientHeight);
      const next = [...opsRef.current];
      for (let i = next.length - 1; i >= 0; i--) {
        if (hitOp(next[i], p, minSide)) {
          next.splice(i, 1);
          onChange(next);
          break;
        }
      }
    };

    const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current) return;
      drawing.current.push(norm(e));
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = wrap.getBoundingClientRect();
      ctx.setTransform(
        Math.min(2, window.devicePixelRatio || 1),
        0,
        0,
        Math.min(2, window.devicePixelRatio || 1),
        0,
        0,
      );
      drawOps(ctx, opsRef.current, rect.width, rect.height);
      const pts = drawing.current;
      ctx.beginPath();
      ctx.strokeStyle = "#ff3b30";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 3;
      ctx.moveTo(pts[0].x * rect.width, pts[0].y * rect.height);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * rect.width, pts[i].y * rect.height);
      }
      ctx.stroke();
    };

    const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (drawing.current) {
        const pts = drawing.current;
        drawing.current = null;
        if (pts.length >= 2) {
          const wrap = wrapRef.current!;
          const minSide = Math.min(wrap.clientWidth, wrap.clientHeight);
          onChange([
            ...opsRef.current,
            { kind: "stroke", points: pts, width: 3 / minSide },
          ]);
        }
      }
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    };

    useEffect(() => {
      if (!edit) return;
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }, [edit?.x, edit?.y]);

    const commitText = () => {
      const cur = editRef.current;
      if (!cur) return;
      const text = cur.value.trim();
      if (text) {
        onChange([
          ...opsRef.current,
          { kind: "text", x: cur.x, y: cur.y, text },
        ]);
      }
      setEdit(null);
    };

    return (
      <div
        ref={wrapRef}
        className={[
          "viewer-annotate-layer",
          capturing ? "is-capturing" : "",
          visible ? "" : "is-hidden",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {edit ? (
          <input
            ref={inputRef}
            className="viewer-annotate-text"
            style={{ left: `${edit.x * 100}%`, top: `${edit.y * 100}%` }}
            value={edit.value}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => setEdit({ ...edit, value: e.target.value })}
            onBlur={() => {
              if (Date.now() - placedAt.current < 250) {
                inputRef.current?.focus();
                return;
              }
              commitText();
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                e.preventDefault();
                commitText();
              }
              if (e.key === "Escape") setEdit(null);
            }}
          />
        ) : null}
      </div>
    );
  },
);

export async function exportAnnotateJpeg(
  glCanvas: HTMLCanvasElement,
  ops: AnnotateOp[],
  cssW: number,
  cssH: number,
): Promise<Blob> {
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  const srcW = glCanvas.width;
  const srcH = glCanvas.height;
  const max = 1280;
  const scale = Math.min(1, max / Math.max(srcW, srcH, 1));
  const dw = Math.max(1, Math.round(srcW * scale));
  const dh = Math.max(1, Math.round(srcH * scale));
  const overlay = document.createElement("canvas");
  overlay.width = dw;
  overlay.height = dh;
  const octx = overlay.getContext("2d");
  if (!octx) throw new Error("canvas");
  octx.scale(dw / Math.max(cssW, 1), dh / Math.max(cssH, 1));
  drawOps(octx, ops, cssW, cssH);

  const out = document.createElement("canvas");
  out.width = dw;
  out.height = dh;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, dw, dh);
  ctx.drawImage(glCanvas, 0, 0, dw, dh);
  ctx.drawImage(overlay, 0, 0, dw, dh);
  const qualities = [0.72, 0.55, 0.4];
  for (const q of qualities) {
    const blob = await new Promise<Blob | null>((resolve) => {
      out.toBlob((b) => resolve(b), "image/jpeg", q);
    });
    if (blob && blob.size <= 400 * 1024) return blob;
    if (blob && q === qualities[qualities.length - 1]) return blob;
  }
  throw new Error("jpeg");
}
