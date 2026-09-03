import { parseSurveySlot, SURVEY_OTHER_QUESTION, SURVEY_QUESTIONS } from "./survey.js";

export type SurveyQuestionKind = "choice" | "note";

export type SurveyQuestionDef = {
  id: string;
  text: string;
  kind: SurveyQuestionKind;
  annotate: boolean;
};

export type ShareSurveyDef = {
  schemaVersion: 1;
  instruction: string;
  questions: SurveyQuestionDef[];
};

export function seedSurveyDef(): ShareSurveyDef {
  return {
    schemaVersion: 1,
    instruction: "",
    questions: [
      {
        id: "dims",
        text: SURVEY_QUESTIONS.dims,
        kind: "choice",
        annotate: true,
      },
      {
        id: "decor",
        text: SURVEY_QUESTIONS.decor,
        kind: "choice",
        annotate: true,
      },
      {
        id: "facades",
        text: SURVEY_QUESTIONS.facades,
        kind: "choice",
        annotate: true,
      },
      {
        id: "other",
        text: SURVEY_OTHER_QUESTION,
        kind: "note",
        annotate: true,
      },
    ],
  };
}

function isKind(v: unknown): v is SurveyQuestionKind {
  return v === "choice" || v === "note";
}

export function parseShareSurveyDef(data: unknown): ShareSurveyDef | null {
  if (!data || typeof data !== "object") return null;
  const o = data as {
    schemaVersion?: unknown;
    instruction?: unknown;
    questions?: unknown;
  };
  if (o.schemaVersion !== 1) return null;
  if (typeof o.instruction !== "string") return null;
  if (!Array.isArray(o.questions) || o.questions.length < 1) return null;
  const seen = new Set<string>();
  const questions: SurveyQuestionDef[] = [];
  for (const raw of o.questions) {
    if (!raw || typeof raw !== "object") return null;
    const q = raw as {
      id?: unknown;
      text?: unknown;
      kind?: unknown;
      annotate?: unknown;
    };
    if (typeof q.id !== "string" || !parseSurveySlot(q.id)) return null;
    if (seen.has(q.id)) return null;
    seen.add(q.id);
    if (typeof q.text !== "string") return null;
    if (!isKind(q.kind)) return null;
    if (typeof q.annotate !== "boolean") return null;
    questions.push({
      id: q.id,
      text: q.text,
      kind: q.kind,
      annotate: q.annotate,
    });
  }
  return {
    schemaVersion: 1,
    instruction: o.instruction,
    questions,
  };
}
