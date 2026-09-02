import type { SurveyFormDraft, SurveySlot } from "./surveyTypes.js";
import { SURVEY_ITEM_KEYS, SURVEY_SLOTS, emptySurveyForm } from "./surveyTypes.js";

export type AnnotateOp =
  | { kind: "stroke"; points: Array<{ x: number; y: number }>; width: number }
  | { kind: "text"; x: number; y: number; text: string }
  | { kind: "symbol"; x: number; y: number; glyph: string };

export type AnnotateBySlot = Record<SurveySlot, AnnotateOp[]>;

export type SurveyLocalDraft = {
  v: 1;
  form: SurveyFormDraft;
  slot: SurveySlot;
  annot: AnnotateBySlot;
};

const PREFIX = "formo.shareSurveyDraft.";

export function emptyAnnot(): AnnotateBySlot {
  return { dims: [], decor: [], facades: [], other: [] };
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

export function loadSurveyLocalDraft(token: string): SurveyLocalDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SurveyLocalDraft;
    if (parsed.v !== 1 || !parsed.form || !parsed.annot) return null;
    if (!SURVEY_SLOTS.includes(parsed.slot)) return null;
    const annot = emptyAnnot();
    for (const slot of SURVEY_SLOTS) {
      const ops = parsed.annot[slot];
      annot[slot] = Array.isArray(ops) ? ops.filter(isOp) : [];
    }
    return { v: 1, form: parsed.form, slot: parsed.slot, annot };
  } catch {
    return null;
  }
}

export function saveSurveyLocalDraft(
  token: string,
  draft: Omit<SurveyLocalDraft, "v">,
): void {
  try {
    const payload: SurveyLocalDraft = { v: 1, ...draft };
    localStorage.setItem(draftKey(token), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function isBlankLocalDraft(draft: Omit<SurveyLocalDraft, "v">): boolean {
  const { form, annot } = draft;
  const itemsBlank = SURVEY_ITEM_KEYS.every((key) => {
    const item = form.items[key];
    return item.status === null && item.comment.trim().length === 0;
  });
  const annotBlank = SURVEY_SLOTS.every((s) => annot[s].length === 0);
  return itemsBlank && form.other.trim().length === 0 && annotBlank;
}
