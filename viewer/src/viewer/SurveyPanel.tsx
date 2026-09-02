import { useEffect, useRef, useState, type RefObject } from "react";
import {
  AnnotateLayer,
  exportAnnotateJpeg,
  type AnnotateLayerHandle,
  type AnnotateTool,
} from "./AnnotateLayer.js";
import {
  emptyAnnot,
  isBlankLocalDraft,
  loadSurveyLocalDraft,
  saveSurveyLocalDraft,
  type AnnotateBySlot,
  type AnnotateOp,
} from "./surveyDraft.js";
import {
  SURVEY_ITEM_KEYS,
  SURVEY_SLOTS,
  SURVEY_SLOT_QUESTIONS,
  emptySurveyForm,
  formToDraft,
  parseShareSurvey,
  surveyToForm,
  type SurveyFormDraft,
  type SurveySlot,
  type SurveyStatus,
} from "./surveyTypes.js";

type Props = {
  token: string;
  open: boolean;
  frozen: boolean;
  glCanvasRef: RefObject<HTMLCanvasElement | null>;
  annotateEnabled?: boolean;
};

function speechCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function slotIndex(slot: SurveySlot): number {
  return SURVEY_SLOTS.indexOf(slot);
}

export function SurveyPanel({
  token,
  open,
  frozen,
  glCanvasRef,
  annotateEnabled = true,
}: Props) {
  const [form, setForm] = useState<SurveyFormDraft>(() => emptySurveyForm());
  const [slot, setSlot] = useState<SurveySlot>("dims");
  const [annot, setAnnot] = useState<AnnotateBySlot>(() => emptyAnnot());
  const [undone, setUndone] = useState<AnnotateBySlot>(() => emptyAnnot());
  const [tool, setTool] = useState<AnnotateTool>("pen");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const layerRef = useRef<AnnotateLayerHandle>(null);
  const jpegRef = useRef<Partial<Record<SurveySlot, Blob>>>({});
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const annotRef = useRef(annot);
  annotRef.current = annot;

  const [ready, setReady] = useState(false);

  useEffect(() => {
    let revoked = false;
    setReady(false);
    const local = loadSurveyLocalDraft(token);
    if (local) {
      setForm(local.form);
      setSlot(local.slot);
      setAnnot(local.annot);
    }
    (async () => {
      try {
        const res = await fetch(`/api/models/${encodeURIComponent(token)}/survey`);
        if (res.status === 404) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const parsed = parseShareSurvey(await res.json());
        if (revoked || !parsed) return;
        const current = loadSurveyLocalDraft(token);
        if (!current || isBlankLocalDraft(current)) {
          setForm(surveyToForm(parsed));
        }
      } catch {
        if (!revoked) setStatus("Не удалось загрузить ответы");
      } finally {
        if (!revoked) setReady(true);
      }
    })();
    return () => {
      revoked = true;
    };
  }, [token]);

  useEffect(() => {
    if (!ready) return;
    saveSurveyLocalDraft(token, { form, slot, annot });
  }, [ready, token, form, slot, annot]);

  const capturing = open && frozen && annotateEnabled;
  const draft = formToDraft(form);
  const idx = slotIndex(slot);
  const last = idx === SURVEY_SLOTS.length - 1;
  const question = SURVEY_SLOT_QUESTIONS[slot];
  const hasMic = speechCtor() != null;

  const setOps = (ops: AnnotateOp[]) => {
    setAnnot((cur) => ({ ...cur, [slot]: ops }));
    setUndone((cur) => ({ ...cur, [slot]: [] }));
  };

  const undo = () => {
    const ops = annot[slot];
    if (ops.length === 0) return;
    const lastOp = ops[ops.length - 1];
    setAnnot({ ...annot, [slot]: ops.slice(0, -1) });
    setUndone({ ...undone, [slot]: [...undone[slot], lastOp] });
  };

  const redo = () => {
    const stack = undone[slot];
    if (stack.length === 0) return;
    const op = stack[stack.length - 1];
    setUndone({ ...undone, [slot]: stack.slice(0, -1) });
    setAnnot({ ...annot, [slot]: [...annot[slot], op] });
  };

  const captureSlot = async (target: SurveySlot): Promise<void> => {
    const gl = glCanvasRef.current;
    const overlay = layerRef.current?.canvas();
    const wrap = overlay?.parentElement;
    if (!gl || !wrap) return;
    try {
      jpegRef.current[target] = await exportAnnotateJpeg(
        gl,
        annotRef.current[target],
        wrap.clientWidth,
        wrap.clientHeight,
      );
    } catch {
      /* keep previous blob */
    }
  };

  const goSlot = async (next: SurveySlot) => {
    await captureSlot(slot);
    setSlot(next);
    setStatus(null);
  };

  const setItem = (
    key: (typeof SURVEY_ITEM_KEYS)[number],
    patch: Partial<SurveyFormDraft["items"]["dims"]>,
  ) => {
    setForm((cur) => ({
      ...cur,
      items: { ...cur.items, [key]: { ...cur.items[key], ...patch } },
    }));
    setStatus(null);
  };

  const appendComment = (text: string) => {
    if (slot === "other") {
      setForm((cur) => ({
        ...cur,
        other: cur.other ? `${cur.other} ${text}` : text,
      }));
      return;
    }
    setForm((cur) => ({
      ...cur,
      items: {
        ...cur.items,
        [slot]: {
          ...cur.items[slot],
          comment: cur.items[slot].comment
            ? `${cur.items[slot].comment} ${text}`
            : text,
        },
      },
    }));
  };

  const toggleMic = () => {
    const Ctor = speechCtor();
    if (!Ctor) return;
    if (listening && recRef.current) {
      recRef.current.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = "ru-RU";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (ev) => {
      const chunk = ev.results[ev.results.length - 1]?.[0]?.transcript?.trim();
      if (chunk) appendComment(chunk);
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };
    rec.onerror = () => {
      setListening(false);
      recRef.current = null;
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const submit = async () => {
    const body = formToDraft(form);
    if (!body || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      await captureSlot(slot);
      for (const s of SURVEY_SLOTS) {
        if (!jpegRef.current[s]) await captureSlot(s);
        const blob = jpegRef.current[s];
        if (!blob) continue;
        const res = await fetch(
          `/api/models/${encodeURIComponent(token)}/survey/image/${s}`,
          {
            method: "PUT",
            headers: { "Content-Type": "image/jpeg" },
            body: blob,
          },
        );
        if (res.status === 403) {
          setStatus("Опросник выключен");
          return;
        }
        if (!res.ok) {
          setStatus(`Ошибка картинки (${res.status})`);
          return;
        }
      }
      const res = await fetch(`/api/models/${encodeURIComponent(token)}/survey`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 403) {
        setStatus("Опросник выключен");
        return;
      }
      if (!res.ok) {
        setStatus(`Ошибка отправки (${res.status})`);
        return;
      }
      const parsed = parseShareSurvey(await res.json());
      if (parsed) setForm(surveyToForm(parsed));
      setStatus("Отправлено");
    } catch {
      setStatus("Ошибка сети");
    } finally {
      setBusy(false);
    }
  };

  const comment =
    slot === "other" ? form.other : form.items[slot].comment;
  const itemStatus = slot === "other" ? null : form.items[slot].status;

  return (
    <>
      {open && annotateEnabled ? (
        <div className="viewer-annotate" role="toolbar" aria-label="Пометки">
          <button
            type="button"
            className={tool === "pen" ? "is-active" : undefined}
            title="Карандаш"
            aria-label="Карандаш"
            aria-pressed={tool === "pen"}
            onClick={() => setTool("pen")}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <path
                d="M11.2 2.4 13.6 4.8 5.6 12.8H3.2v-2.4z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinejoin="round"
              />
              <path
                d="M9.9 3.7 12.3 6.1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className={tool === "text" ? "is-active" : undefined}
            title="Текст"
            aria-pressed={tool === "text"}
            onClick={() => setTool("text")}
          >
            T
          </button>
          <button
            type="button"
            className={tool === "erase" ? "is-active" : undefined}
            title="Ластик"
            aria-label="Ластик"
            aria-pressed={tool === "erase"}
            onClick={() => setTool("erase")}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <path
                d="M3.2 9.2 8.4 4l3.6 3.6-5.2 5.2H3.6z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinejoin="round"
              />
              <path
                d="M4.8 12.8h7.4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button type="button" title="Отменить" disabled={annot[slot].length === 0} onClick={undo}>
            ↩
          </button>
          <button type="button" title="Повторить" disabled={undone[slot].length === 0} onClick={redo}>
            ↪
          </button>
          {hasMic ? (
            <button
              type="button"
              className={listening ? "is-active" : undefined}
              title="Голос в комментарий"
              aria-pressed={listening}
              onClick={toggleMic}
            >
              голос
            </button>
          ) : null}
        </div>
      ) : null}
      <AnnotateLayer
        ref={layerRef}
        ops={annot[slot]}
        onChange={setOps}
        tool={tool}
        capturing={capturing}
        visible={open}
      />
      {open ? (
        <form
          className="viewer-survey-dock"
          onSubmit={(e) => {
            e.preventDefault();
            if (last) void submit();
            else void goSlot(SURVEY_SLOTS[idx + 1]);
          }}
        >
          <p className="viewer-survey-step">
            {idx + 1} / {SURVEY_SLOTS.length}
          </p>
          <p className="viewer-survey-qtext">{question}</p>
          {slot !== "other" ? (
            <div className="viewer-survey-radios">
              <label>
                <input
                  type="radio"
                  name={`survey-${slot}`}
                  checked={itemStatus === "ok"}
                  onChange={() => setItem(slot, { status: "ok" as SurveyStatus })}
                />
                Ок
              </label>
              <label>
                <input
                  type="radio"
                  name={`survey-${slot}`}
                  checked={itemStatus === "not_ok"}
                  onChange={() =>
                    setItem(slot, { status: "not_ok" as SurveyStatus })
                  }
                />
                Не ок
              </label>
            </div>
          ) : null}
          <textarea
            value={comment}
            onChange={(e) => {
              if (slot === "other") {
                setForm((cur) => ({ ...cur, other: e.target.value }));
              } else {
                setItem(slot, { comment: e.target.value });
              }
              setStatus(null);
            }}
            placeholder={
              itemStatus === "not_ok" ? "Что именно не так" : "Комментарий"
            }
            required={itemStatus === "not_ok"}
            rows={2}
          />
          <div className="viewer-survey-actions">
            <button
              type="button"
              disabled={idx === 0 || busy}
              onClick={() => void goSlot(SURVEY_SLOTS[idx - 1])}
            >
              Назад
            </button>
            {last ? (
              <button type="submit" disabled={!draft || busy}>
                {busy ? "…" : "Отправить"}
              </button>
            ) : (
              <button type="submit" disabled={busy}>
                Далее
              </button>
            )}
            {status ? <span className="viewer-survey-status">{status}</span> : null}
          </div>
        </form>
      ) : null}
    </>
  );
}
