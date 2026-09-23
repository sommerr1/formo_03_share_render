import { useEffect, useRef, useState, type TouchEvent } from "react";
import type { PromoManifest } from "./promoManifest.js";

type PinchState = {
  scale: number;
  x: number;
  y: number;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function distance(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.hypot(dx, dy);
}

export function PromoViewerUI({
  manifest,
  onLoad3D,
  onDownloadGlb,
  showLoad3D,
  showDownload,
  downloadBusy,
}: {
  manifest: PromoManifest;
  onLoad3D: () => void;
  onDownloadGlb: () => void;
  showLoad3D: boolean;
  showDownload: boolean;
  downloadBusy?: boolean;
}) {
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const [showTextModal, setShowTextModal] = useState(false);
  const [pinch, setPinch] = useState<PinchState>({ scale: 1, x: 0, y: 0 });

  const touchRef = useRef<{
    mode: "none" | "pan" | "pinch" | "swipe";
    startX: number;
    startY: number;
    startDist: number;
    startScale: number;
    startPanX: number;
    startPanY: number;
    lastTap: number;
  }>({
    mode: "none",
    startX: 0,
    startY: 0,
    startDist: 0,
    startScale: 1,
    startPanX: 0,
    startPanY: 0,
    lastTap: 0,
  });

  const frames = manifest.frames;
  const currentFrame = frames[activeFrameIndex];

  useEffect(() => {
    setPinch({ scale: 1, x: 0, y: 0 });
  }, [activeFrameIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setActiveFrameIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight") {
        setActiveFrameIndex((prev) => Math.min(frames.length - 1, prev + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [frames.length]);

  const resetPinch = () => setPinch({ scale: 1, x: 0, y: 0 });

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const t = touchRef.current;
    if (e.touches.length === 2) {
      t.mode = "pinch";
      t.startDist = distance(e.touches[0]!, e.touches[1]!);
      t.startScale = pinch.scale;
      t.startPanX = pinch.x;
      t.startPanY = pinch.y;
      return;
    }
    if (e.touches.length === 1) {
      const now = Date.now();
      if (now - t.lastTap < 300) {
        resetPinch();
        t.lastTap = 0;
        return;
      }
      t.lastTap = now;
      t.mode = pinch.scale > 1.02 ? "pan" : "swipe";
      t.startX = e.touches[0]!.clientX;
      t.startY = e.touches[0]!.clientY;
      t.startPanX = pinch.x;
      t.startPanY = pinch.y;
    }
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    const t = touchRef.current;
    if (t.mode === "pinch" && e.touches.length === 2) {
      const dist = distance(e.touches[0]!, e.touches[1]!);
      if (t.startDist > 0) {
        const next = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, t.startScale * (dist / t.startDist)),
        );
        setPinch((p) => ({ ...p, scale: next }));
      }
      return;
    }
    if (t.mode === "pan" && e.touches.length === 1) {
      const dx = e.touches[0]!.clientX - t.startX;
      const dy = e.touches[0]!.clientY - t.startY;
      setPinch((p) => ({
        ...p,
        x: t.startPanX + dx,
        y: t.startPanY + dy,
      }));
    }
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const t = touchRef.current;
    if (t.mode === "swipe" && e.changedTouches.length === 1 && pinch.scale <= 1.02) {
      const dx = e.changedTouches[0]!.clientX - t.startX;
      if (Math.abs(dx) > 48) {
        if (dx < 0) {
          setActiveFrameIndex((p) => Math.min(frames.length - 1, p + 1));
        } else {
          setActiveFrameIndex((p) => Math.max(0, p - 1));
        }
      }
    }
    t.mode = "none";
  };

  if (!currentFrame && frames.length === 0) {
    return (
      <div className="promo-viewer-empty">
        <p>Галерея кадров пуста</p>
        {showLoad3D && (
          <button type="button" className="promo-viewer-3d-btn" onClick={onLoad3D}>
            📦 Загрузить 3D модель
          </button>
        )}
      </div>
    );
  }

  const overlay = currentFrame?.overlayText;

  return (
    <div className="promo-viewer-container">
      <div
        className="promo-viewer-frame-viewport"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {manifest.backgroundImageUrl && (
          <img
            src={manifest.backgroundImageUrl}
            alt="Фон помещения"
            className="promo-viewer-bg-photo"
          />
        )}
        <div
          className="promo-viewer-frame-stage"
          style={{
            transform: `translate(${pinch.x}px, ${pinch.y}px) scale(${pinch.scale})`,
          }}
        >
          <img
            src={currentFrame?.imageDataUrl}
            alt={currentFrame?.title || `Кадр ${activeFrameIndex + 1}`}
            className="promo-viewer-frame-img"
            draggable={false}
          />
        </div>

        {overlay && overlay.text && (
          <>
            <div
              className="promo-viewer-overlay-text desktop-only"
              style={{
                left: `${overlay.position?.xPercent ?? 50}%`,
                top: `${overlay.position?.yPercent ?? 80}%`,
                fontFamily: overlay.fontFamily || "inherit",
                fontSize: `${overlay.fontSize || 16}px`,
                color: overlay.color || "#ffffff",
                backgroundColor: overlay.backgroundColor || "rgba(0,0,0,0.6)",
                border: overlay.borderColor ? `1px solid ${overlay.borderColor}` : "none",
              }}
            >
              {overlay.text}
            </div>

            <button
              type="button"
              className="promo-viewer-help-icon mobile-only"
              onClick={() => setShowTextModal(true)}
              title="Показать описание кадра"
            >
              ?
            </button>
          </>
        )}

        {frames.length > 1 && pinch.scale <= 1.02 && (
          <>
            <button
              type="button"
              className="promo-viewer-arrow promo-viewer-arrow--prev"
              disabled={activeFrameIndex === 0}
              onClick={() => setActiveFrameIndex((p) => Math.max(0, p - 1))}
            >
              ‹
            </button>
            <button
              type="button"
              className="promo-viewer-arrow promo-viewer-arrow--next"
              disabled={activeFrameIndex === frames.length - 1}
              onClick={() => setActiveFrameIndex((p) => Math.min(frames.length - 1, p + 1))}
            >
              ›
            </button>
          </>
        )}
      </div>

      {showDownload && (
        <button
          type="button"
          className="promo-viewer-download-fab"
          disabled={downloadBusy}
          onClick={() => onDownloadGlb()}
          title="Скачать 3D модель (GLB)"
        >
          {downloadBusy ? "…" : "⬇ GLB"}
        </button>
      )}

      <div className="promo-viewer-bottom-bar">
        <div className="promo-viewer-bottom-left">
          <div className="promo-viewer-carousel">
            {frames.map((frame, idx) => (
              <button
                type="button"
                key={frame.id}
                className={`promo-viewer-thumb${idx === activeFrameIndex ? " is-active" : ""}`}
                onClick={() => setActiveFrameIndex(idx)}
              >
                <img src={frame.imageDataUrl} alt="" />
                <span className="promo-viewer-thumb-num">{idx + 1}</span>
              </button>
            ))}
          </div>

          {manifest.relatedTokens && manifest.relatedTokens.length > 0 && (
            <div className="promo-viewer-lookbook">
              <span className="promo-viewer-lookbook-title">Похожие проекты:</span>
              <div className="promo-viewer-lookbook-tokens">
                {manifest.relatedTokens.map((item, idx) => {
                  const token = typeof item === "string" ? item : item.token;
                  const label =
                    typeof item === "object" && item.label?.trim()
                      ? item.label.trim()
                      : `Проект #${idx + 1}`;
                  return (
                    <a
                      key={token}
                      href={`/v/${encodeURIComponent(token)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="promo-viewer-lookbook-link"
                      title={`Открыть ${label}`}
                    >
                      {label}
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {showLoad3D && (
          <button type="button" className="promo-viewer-3d-btn" onClick={onLoad3D}>
            📦 Загрузить 3D модель
          </button>
        )}
      </div>

      {showTextModal && overlay && (
        <div className="promo-viewer-text-modal" onClick={() => setShowTextModal(false)}>
          <div className="promo-viewer-text-modal-content" onClick={(e) => e.stopPropagation()}>
            <p>{overlay.text}</p>
            <button type="button" onClick={() => setShowTextModal(false)}>
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
