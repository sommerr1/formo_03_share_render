import { useEffect, useState } from "react";
import type { PromoManifest } from "./promoManifest.js";

export function PromoViewerUI({
  manifest,
  onLoad3D,
  allow3D,
}: {
  manifest: PromoManifest;
  onLoad3D: () => void;
  allow3D: boolean;
}) {
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const [showTextModal, setShowTextModal] = useState(false);

  const frames = manifest.frames;
  const currentFrame = frames[activeFrameIndex];

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

  if (!currentFrame && frames.length === 0) {
    return (
      <div className="promo-viewer-empty">
        <p>Галерея кадров пуста</p>
        {allow3D && (
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
      {/* Основной слайд кадра */}
      <div className="promo-viewer-frame-viewport">
        {manifest.backgroundImageUrl && (
          <img
            src={manifest.backgroundImageUrl}
            alt="Фон помещения"
            className="promo-viewer-bg-photo"
          />
        )}
        <img
          src={currentFrame?.imageDataUrl}
          alt={currentFrame?.title || `Кадр ${activeFrameIndex + 1}`}
          className="promo-viewer-frame-img"
        />

        {/* Текстовая надпись на кадре (Десктоп) */}
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

            {/* Иконка '?' для мобильных */}
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

        {/* Навигационные стрелки ‹ › на слайде */}
        {frames.length > 1 && (
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

      {/* Нижний тулбар и карусель превью кадров */}
      <div className="promo-viewer-bottom-bar">
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

        {/* Кнопка "Загрузить 3D модель" On-Demand */}
        {allow3D && (
          <button type="button" className="promo-viewer-3d-btn" onClick={onLoad3D}>
            📦 Загрузить 3D модель
          </button>
        )}
      </div>

      {/* Мобильная модалка описания при клике на '?' */}
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
