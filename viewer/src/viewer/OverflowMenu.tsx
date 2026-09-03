import { useEffect, useRef, useState, type ChangeEvent } from "react";

type Props = {
  hasFillers: boolean;
  showFillers: boolean;
  onShowFillers: (v: boolean) => void;
  satOn: boolean;
  onSatOn: (v: boolean) => void;
  hasPhoto: boolean;
  onPhotoFile: (file: File) => void;
  onPhotoClear: () => void;
  onDownloadGlb: () => void;
  glbBusy: boolean;
  showGlbAr: boolean;
  showBgPhoto: boolean;
  showSat: boolean;
  showFillersToggle: boolean;
};

export function OverflowMenu({
  hasFillers,
  showFillers,
  onShowFillers,
  satOn,
  onSatOn,
  hasPhoto,
  onPhotoFile,
  onPhotoClear,
  onDownloadGlb,
  glbBusy,
  showGlbAr,
  showBgPhoto,
  showSat,
  showFillersToggle,
}: Props) {
  const [open, setOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setPhotoOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      onPhotoFile(file);
      setPhotoOpen(false);
      setOpen(false);
    }
  };

  return (
    <div className="viewer-overflow" ref={wrapRef}>
      <button
        type="button"
        className={open ? "is-active" : undefined}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Настройки"
        title="Настройки"
        onClick={() => {
          setOpen((v) => !v);
          setPhotoOpen(false);
        }}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
          <path
            d="M2.5 4h11M2.5 8h11M2.5 12h11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {open ? (
        <div className="viewer-overflow-panel" role="menu">
          {showGlbAr ? (
          <button
            type="button"
            role="menuitem"
            disabled={glbBusy}
            title="GLB для дополненной реальности (без доборов; фальш остаётся)"
            onClick={() => {
              onDownloadGlb();
              setOpen(false);
            }}
          >
            {glbBusy ? "GLB…" : "Получить GLB для доп. реальности"}
          </button>
          ) : null}
          {showBgPhoto ? (
          <>
          <button
            type="button"
            role="menuitem"
            aria-expanded={photoOpen}
            onClick={() => setPhotoOpen((v) => !v)}
          >
            Фото для фона
          </button>
          {photoOpen ? (
            <div className="viewer-overflow-sub">
              <button type="button" onClick={() => fileRef.current?.click()}>
                Загрузить
              </button>
              <button type="button" onClick={() => camRef.current?.click()}>
                Сфоткать
              </button>
              {hasPhoto ? (
                <button
                  type="button"
                  onClick={() => {
                    onPhotoClear();
                    setPhotoOpen(false);
                  }}
                >
                  Убрать
                </button>
              ) : null}
            </div>
          ) : null}
          </>
          ) : null}
          {showSat ? (
          <label className="viewer-overflow-check">
            <input
              type="checkbox"
              checked={satOn}
              onChange={(e) => onSatOn(e.target.checked)}
            />
            Цвета насыщеннее
          </label>
          ) : null}
          {showFillersToggle && hasFillers ? (
            <label className="viewer-overflow-check">
              <input
                type="checkbox"
                checked={showFillers}
                onChange={(e) => onShowFillers(e.target.checked)}
              />
              Показать доборы
            </label>
          ) : null}
        </div>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={onPick}
      />
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onPick}
      />
    </div>
  );
}
