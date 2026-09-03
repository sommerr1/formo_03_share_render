import type { SurveyItemDraft } from "./surveyTypes.js";
import { emptyQuestionDraft } from "./surveyTypes.js";

export type AnnotateOp =
  | { kind: "stroke"; points: Array<{ x: number; y: number }>; width: number }
  | { kind: "text"; x: number; y: number; text: string }
  | { kind: "symbol"; x: number; y: number; glyph: string };

export type AnnotateById = Record<string, AnnotateOp[]>;

export type SurveyLocalDraft = {
  v: 2;
  form: Record<string, SurveyItemDraft>;
  qid: string;
  annot: AnnotateById;
};

const PREFIX = "formo.shareSurveyDraft.";

export function emptyAnnot(ids: string[]): AnnotateById {
  const out: AnnotateById = {};
  for (const id of ids) out[id] = [];
  return out;
}

function draftKey(token: string): string {
  return `${PREFIX}${token}`;
}

function isOp(v: unknown): v is AnnotateOp {
  if (!v || typeof v !== "object") return false;
  const o = v as { kind?: unknown };
  if (o.kind === "stroke") {
    const s = o as { points?: unknown; width?: unknown };
    if (!Array.isArray(s.points) || typeof s.width !== "number") return false;
    return s.points.every(
      (p) =>
        p &&
        typeof p === "object" &&
        typeof (p as { x?: unknown }).x === "number" &&
        typeof (p as { y?: unknown }).y === "number",
    );
  }
  if (o.kind === "text") {
    const t = o as { x?: unknown; y?: unknown; text?: unknown };
    return (
      typeof t.x === "number" &&
      typeof t.y === "number" &&
      typeof t.text === "string"
    );
  }
  if (o.kind === "symbol") {
    const t = o as { x?: unknown; y?: unknown; glyph?: unknown };
    return (
      typeof t.x === "number" &&
      typeof t.y === "number" &&
      typeof t.glyph === "string"
    );
  }
  return false;
}

function parseForm(raw: unknown): Record<string, SurveyItemDraft> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, SurveyItemDraft> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const o = v as { status?: unknown; comment?: unknown };
    if (typeof o.comment !== "string") continue;
    const status =
      o.status === "ok" || o.status === "not_ok" || o.status === null
        ? o.status
        : null;
    out[id] = { status, comment: o.comment };
  }
  return out;
}

export function loadSurveyLocalDraft(token: string): SurveyLocalDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      v?: unknown;
      form?: unknown;
      qid?: unknown;
      annot?: unknown;
      slot?: unknown;
    };
    if (parsed.v === 2) {
      const form = parseForm(parsed.form);
      if (!form || typeof parsed.qid !== "string") return null;
      const annot: AnnotateById = {};
      if (parsed.annot && typeof parsed.annot === "object") {
        for (const [id, ops] of Object.entries(
          parsed.annot as Record<string, unknown>,
        )) {
          annot[id] = Array.isArray(ops) ? ops.filter(isOp) : [];
        }
      }
      return { v: 2, form, qid: parsed.qid, annot };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSurveyLocalDraft(
  token: string,
  draft: Omit<SurveyLocalDraft, "v">,
): void {
  try {
    const payload: SurveyLocalDraft = { v: 2, ...draft };
    localStorage.setItem(draftKey(token), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function isBlankLocalDraft(
  draft: Omit<SurveyLocalDraft, "v">,
  ids: string[],
): boolean {
  const itemsBlank = ids.every((id) => {
    const item = draft.form[id] ?? emptyQuestionDraft();
    return item.status === null && item.comment.trim().length === 0;
  });
  const annotBlank = ids.every((id) => (draft.annot[id] ?? []).length === 0);
  return itemsBlank && annotBlank;
}
