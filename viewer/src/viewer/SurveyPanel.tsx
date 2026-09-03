import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import {
  AnnotateLayer,
  exportAnnotateJpeg,
  type AnnotateLayerHandle,
  type AnnotateTool,
} from "./AnnotateLayer.js";
import { parseShareSurveyDef, seedSurveyDef, type ShareSurveyDef } from "./surveyDef.js";
import {
  emptyAnnot,
  isBlankLocalDraft,
  loadSurveyLocalDraft,
  saveSurveyLocalDraft,
  type AnnotateById,
  type AnnotateOp,
} from "./surveyDraft.js";
import {
  emptyQuestionDraft,
  formToDraftV3,
  parseShareSurvey,
  surveyFormHasInput,
  surveyToQuestionDrafts,
  type SurveyItemDraft,
  type SurveyStatus,
} from "./surveyTypes.js";

type Props = {
  token: string;
  open: boolean;
  frozen: boolean;
  glCanvasRef: RefObject<HTMLCanvasElement | null>;
  annotateEnabled?: boolean;
};

const INTRO_ID = "__intro";
const SWIPE_PX = 36;
const SWIPE_MAX = 80;

function emptyForm(ids: string[]): Record<string, SurveyItemDraft> {
  const out: Record<string, SurveyItemDraft> = {};
  for (const id of ids) out[id] = emptyQuestionDraft();
  return out;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function SurveyPanel({
  token,
  open,
  frozen,
  glCanvasRef,
  annotateEnabled = true,
}: Props) {
  const [def, setDef] = useState<ShareSurveyDef>(() => seedSurveyDef());
  const [form, setForm] = useState<Record<string, SurveyItemDraft>>(() =>
    emptyForm(seedSurveyDef().questions.map((q) => q.id)),
  );
  const [qid, setQid] = useState(seedSurveyDef().questions[0]!.id);
  const [annot, setAnnot] = useState<AnnotateById>(() =>
    emptyAnnot(seedSurveyDef().questions.map((q) => q.id)),
  );
  const [undone, setUndone] = useState<AnnotateById>(() => ({}));
  const [tool, setTool] = useState<AnnotateTool | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [swipeDx, setSwipeDx] = useState(0);
  const layerRef = useRef<AnnotateLayerHandle>(null);
  const jpegRef = useRef<Record<string, Blob>>({});
  const annotRef = useRef(annot);
  annotRef.current = annot;
  const swipeRef = useRef<{
    x: number;
    y: number;
    id: number;
    locked: boolean;
  } | null>(null);

  const [ready, setReady] = useState(false);
  const questions = def.questions;
  const ids = questions.map((q) => q.id);
  const instruction = def.instruction.trim();
  const hasIntro = instruction.length > 0;
  const onIntro = hasIntro && qid === INTRO_ID;
  const qIdx = onIntro ? -1 : Math.max(0, ids.indexOf(qid));
  const current = questions[qIdx] ?? questions[0]!;
  const last = !onIntro && qIdx === questions.length - 1;
  const stepCount = questions.length + (hasIntro ? 1 : 0);
  const stepNum = onIntro ? 1 : qIdx + 1 + (hasIntro ? 1 : 0);
  const canBack = onIntro ? false : qIdx > 0 || hasIntro;
  const canForward = !last;
  const qAnnotate = !onIntro && annotateEnabled && current.annotate;
  const hasInput = surveyFormHasInput(form, questions, annot);

  useEffect(() => {
    let revoked = false;
    setReady(false);
    (async () => {
      let nextDef = seedSurveyDef();
      try {
        const defRes = await fetch(
          `/api/models/${encodeURIComponent(token)}/survey/def`,
        );
        if (defRes.ok) {
          const parsed = parseShareSurveyDef(await defRes.json());
          if (parsed) nextDef = parsed;
        }
      } catch {
        /* seed */
      }
      if (revoked) return;
      const nextIds = nextDef.questions.map((q) => q.id);
      const nextHasIntro = nextDef.instruction.trim().length > 0;
      setDef(nextDef);

      const local = loadSurveyLocalDraft(token);
      let nextForm = emptyForm(nextIds);
      let nextQid = nextHasIntro ? INTRO_ID : nextIds[0]!;
      let nextAnnot = emptyAnnot(nextIds);
      if (local) {
        nextForm = { ...nextForm, ...local.form };
        if (local.qid === INTRO_ID && nextHasIntro) nextQid = INTRO_ID;
        else if (nextIds.includes(local.qid)) nextQid = local.qid;
        nextAnnot = { ...nextAnnot, ...local.annot };
      }
      setForm(nextForm);
      setQid(nextQid);
      setAnnot(nextAnnot);

      try {
        const res = await fetch(`/api/models/${encodeURIComponent(token)}/survey`);
        if (res.status === 404) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const parsed = parseShareSurvey(await res.json());
        if (revoked || !parsed) return;
        const currentDraft = loadSurveyLocalDraft(token);
        if (!currentDraft || isBlankLocalDraft(currentDraft, nextIds)) {
          setForm(surveyToQuestionDrafts(parsed, nextIds));
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
    saveSurveyLocalDraft(token, { form, qid, annot });
  }, [ready, token, form, qid, annot]);

  useEffect(() => {
    if (!hasIntro && qid === INTRO_ID && questions[0]) setQid(questions[0].id);
  }, [hasIntro, qid, questions]);

  const capturing = open && frozen && qAnnotate && tool != null;

  const toggleTool = (next: AnnotateTool) => {
    setTool((cur) => (cur === next ? null : next));
  };

  const setOps = (ops: AnnotateOp[]) => {
    setAnnot((cur) => ({ ...cur, [current.id]: ops }));
    setUndone((cur) => ({ ...cur, [current.id]: [] }));
  };

  const undo = () => {
    const ops = annot[current.id] ?? [];
    if (ops.length === 0) return;
    const lastOp = ops[ops.length - 1]!;
    setAnnot({ ...annot, [current.id]: ops.slice(0, -1) });
    setUndone({
      ...undone,
      [current.id]: [...(undone[current.id] ?? []), lastOp],
    });
  };

  const redo = () => {
    const stack = undone[current.id] ?? [];
    if (stack.length === 0) return;
    const op = stack[stack.length - 1]!;
    setUndone({ ...undone, [current.id]: stack.slice(0, -1) });
    setAnnot({ ...annot, [current.id]: [...(annot[current.id] ?? []), op] });
  };

  const captureSlot = async (target: string): Promise<void> => {
    const gl = glCanvasRef.current;
    const overlay = layerRef.current?.canvas();
    const wrap = overlay?.parentElement;
    if (!gl || !wrap) return;
    try {
      jpegRef.current[target] = await exportAnnotateJpeg(
        gl,
        annotRef.current[target] ?? [],
        wrap.clientWidth,
        wrap.clientHeight,
      );
    } catch {
      /* keep previous blob */
    }
  };

  const goId = async (next: string) => {
    if (!onIntro) await captureSlot(current.id);
    setQid(next);
    setStatus(null);
    setSwipeDx(0);
  };

  const goBack = () => {
    if (!canBack || busy) return;
    if (qIdx === 0 && hasIntro) void goId(INTRO_ID);
    else if (qIdx > 0) void goId(ids[qIdx - 1]!);
  };

  const goForward = () => {
    if (!canForward || busy) return;
    if (onIntro) void goId(ids[0]!);
    else void goId(ids[qIdx + 1]!);
  };

  const setItem = (id: string, patch: Partial<SurveyItemDraft>) => {
    setForm((cur) => ({
      ...cur,
      [id]: { ...(cur[id] ?? emptyQuestionDraft()), ...patch },
    }));
    setStatus(null);
  };

  const onDockPointerDown = (e: ReactPointerEvent<HTMLFormElement>) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest("textarea, button")) {
      swipeRef.current = null;
      return;
    }
    swipeRef.current = {
      x: e.clientX,
      y: e.clientY,
      id: e.pointerId,
      locked: false,
    };
  };

  const onDockPointerMove = (e: ReactPointerEvent<HTMLFormElement>) => {
    const start = swipeRef.current;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!start.locked) {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      if (Math.abs(dx) <= Math.abs(dy) * 1.15) {
        swipeRef.current = null;
        setSwipeDx(0);
        return;
      }
      start.locked = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
    setSwipeDx(clamp(dx, -SWIPE_MAX, SWIPE_MAX));
  };

  const onDockPointerUp = (e: ReactPointerEvent<HTMLFormElement>) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    setSwipeDx(0);
    if (!start || start.id !== e.pointerId || busy || !start.locked) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) < SWIPE_PX) return;
    if (dx < 0) goForward();
    else goBack();
  };

  const submit = async () => {
    if (!hasInput || busy) return;
    const body = formToDraftV3(form, questions);
    setBusy(true);
    setStatus(null);
    try {
      if (!onIntro) await captureSlot(current.id);
      for (const q of questions) {
        if (!q.annotate) continue;
        if (!jpegRef.current[q.id]) await captureSlot(q.id);
        const blob = jpegRef.current[q.id];
        if (!blob) continue;
        const res = await fetch(
          `/api/models/${encodeURIComponent(token)}/survey/image/${q.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "image/jpeg" },
            body: blob,
          },
        );
        if (res.status === 403) continue;
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
      if (res.status === 400) {
        setStatus("Напишите комментарий или выберите Да/Нет");
        return;
      }
      if (!res.ok) {
        setStatus(`Ошибка отправки (${res.status})`);
        return;
      }
      const parsed = parseShareSurvey(await res.json());
      if (parsed) setForm(surveyToQuestionDrafts(parsed, ids));
      setStatus("Отправлено");
    } catch {
      setStatus("Ошибка сети");
    } finally {
      setBusy(false);
    }
  };

  const row = form[current.id] ?? emptyQuestionDraft();
  const ops = annot[current.id] ?? [];
  const undoneOps = undone[current.id] ?? [];

  return (
    <>
      {open && qAnnotate ? (
        <div className="viewer-annotate" role="toolbar" aria-label="Пометки">
          <button
            type="button"
            className={tool === "pen" ? "is-active" : undefined}
            title="Карандаш"
            aria-label="Карандаш"
            aria-pressed={tool === "pen"}
            onClick={() => toggleTool("pen")}
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
            onClick={() => toggleTool("text")}
          >
            T
          </button>
          <button
            type="button"
            className={tool === "erase" ? "is-active" : undefined}
            title="Ластик"
            aria-label="Ластик"
            aria-pressed={tool === "erase"}
            onClick={() => toggleTool("erase")}
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
          <button type="button" title="Отменить" disabled={ops.length === 0} onClick={undo}>
            ↩
          </button>
          <button type="button" title="Повторить" disabled={undoneOps.length === 0} onClick={redo}>
            ↪
          </button>
        </div>
      ) : null}
      <AnnotateLayer
        ref={layerRef}
        ops={ops}
        onChange={setOps}
        tool={tool ?? "pen"}
        capturing={capturing}
        visible={open && qAnnotate}
      />
      {open ? (
        <form
          className={
            swipeDx !== 0
              ? "viewer-survey-dock is-swiping"
              : "viewer-survey-dock"
          }
          style={{ transform: `translateX(${swipeDx}px)` }}
          onSubmit={(e) => {
            e.preventDefault();
            if (last) void submit();
          }}
          onPointerDown={onDockPointerDown}
          onPointerMove={onDockPointerMove}
          onPointerUp={onDockPointerUp}
          onPointerCancel={() => {
            swipeRef.current = null;
            setSwipeDx(0);
          }}
        >
          <div className="viewer-survey-grip" aria-hidden>
            <span className="viewer-survey-grip-bar" />
          </div>
          <div className="viewer-survey-nav">
            <button
              type="button"
              className="viewer-survey-chevron"
              disabled={!canBack || busy}
              aria-label="Назад"
              onClick={goBack}
            >
              ‹
            </button>
            <p className="viewer-survey-step">
              {stepNum} / {stepCount}
            </p>
            <button
              type="button"
              className="viewer-survey-chevron"
              disabled={!canForward || busy}
              aria-label="Далее"
              onClick={goForward}
            >
              ›
            </button>
          </div>
          {onIntro ? (
            <p className="viewer-survey-intro">{instruction}</p>
          ) : (
            <>
              <p className="viewer-survey-qtext">{current.text}</p>
              {current.kind === "choice" ? (
                <div className="viewer-survey-radios">
                  <label>
                    <input
                      type="radio"
                      name={`survey-${current.id}`}
                      checked={row.status === "ok"}
                      onChange={() => setItem(current.id, { status: "ok" as SurveyStatus })}
                    />
                    Да
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`survey-${current.id}`}
                      checked={row.status === "not_ok"}
                      onChange={() =>
                        setItem(current.id, { status: "not_ok" as SurveyStatus })
                      }
                    />
                    Нет
                  </label>
                </div>
              ) : null}
              <textarea
                value={row.comment}
                onChange={(e) => setItem(current.id, { comment: e.target.value })}
                rows={2}
              />
            </>
          )}
          {last || status ? (
            <div className="viewer-survey-actions">
              {last ? (
                <button type="submit" disabled={!hasInput || busy}>
                  {busy ? "…" : "Отправить"}
                </button>
              ) : null}
              {status ? <span className="viewer-survey-status">{status}</span> : null}
            </div>
          ) : null}
        </form>
      ) : null}
    </>
  );
}
