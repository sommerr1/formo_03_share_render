export type SurveyStatus = "ok" | "not_ok";

export type SurveyItem = {
  status: SurveyStatus;
  comment: string;
};

export const SURVEY_ITEM_KEYS = ["dims", "decor", "facades"] as const;
export const SURVEY_SLOTS = ["dims", "decor", "facades", "other"] as const;
export type SurveySlot = (typeof SURVEY_SLOTS)[number];

export const SURVEY_SLOT_ID_RE = /^[a-zA-Z0-9_-]{1,32}$/;

export function parseSurveySlot(raw: string | undefined): string | null {
  if (typeof raw !== "string" || !SURVEY_SLOT_ID_RE.test(raw)) return null;
  return raw;
}

export type SurveyAnswer = {
  status?: SurveyStatus;
  comment: string;
};

export type ShareSurveyV12 = {
  schemaVersion: 1 | 2;
  submittedAt: string;
  items: {
    dims: SurveyItem;
    decor: SurveyItem;
    facades: SurveyItem;
  };
  other: string;
  images: Partial<Record<SurveySlot, true>>;
};

export type ShareSurveyV3 = {
  schemaVersion: 3;
  submittedAt: string;
  items: Record<string, SurveyAnswer>;
  images: Record<string, true>;
};

export type ShareSurvey = ShareSurveyV12 | ShareSurveyV3;

export type ShareSurveyV1 = ShareSurveyV12;

export type SurveyDraft = {
  schemaVersion: 1 | 2;
  items: ShareSurveyV12["items"];
  other: string;
};

export type SurveyDraftV3 = {
  schemaVersion: 3;
  items: Record<string, SurveyAnswer>;
};

export type SurveyItemDraft = {
  status: SurveyStatus | null;
  comment: string;
};

export const SURVEY_QUESTIONS: Record<(typeof SURVEY_ITEM_KEYS)[number], string> = {
  dims: "Все ли в порядке с размерами?",
  decor: "Все ли в порядке с декором и сочетаниями цветов?",
  facades: "Все ли в порядке с фасадами?",
};

export const SURVEY_OTHER_QUESTION =
  "Есть ли ещё какие-нибудь комментарии или замечания?";

export const SURVEY_SLOT_QUESTIONS: Record<SurveySlot, string> = {
  dims: SURVEY_QUESTIONS.dims,
  decor: SURVEY_QUESTIONS.decor,
  facades: SURVEY_QUESTIONS.facades,
  other: SURVEY_OTHER_QUESTION,
};

function isSurveyItem(v: unknown): v is SurveyItem {
  if (!v || typeof v !== "object") return false;
  const o = v as { status?: unknown; comment?: unknown };
  if (o.status !== "ok" && o.status !== "not_ok") return false;
  return typeof o.comment === "string";
}

function isSurveyAnswer(v: unknown): v is SurveyAnswer {
  if (!v || typeof v !== "object") return false;
  const o = v as { status?: unknown; comment?: unknown };
  if (typeof o.comment !== "string") return false;
  if (o.status === undefined) return true;
  return o.status === "ok" || o.status === "not_ok";
}

function parseImagesV12(v: unknown): Partial<Record<SurveySlot, true>> {
  if (!v || typeof v !== "object") return {};
  const out: Partial<Record<SurveySlot, true>> = {};
  const rec = v as Record<string, unknown>;
  for (const slot of SURVEY_SLOTS) {
    if (rec[slot] === true) out[slot] = true;
  }
  return out;
}

function parseImagesV3(v: unknown): Record<string, true> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, true> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (val === true && parseSurveySlot(k)) out[k] = true;
  }
  return out;
}

export function isSurveyDraft(data: unknown): data is SurveyDraft {
  if (!data || typeof data !== "object") return false;
  const o = data as {
    schemaVersion?: unknown;
    items?: unknown;
    other?: unknown;
  };
  if (o.schemaVersion !== 1 && o.schemaVersion !== 2) return false;
  if (typeof o.other !== "string") return false;
  if (!o.items || typeof o.items !== "object") return false;
  const items = o.items as Record<string, unknown>;
  for (const key of SURVEY_ITEM_KEYS) {
    if (!isSurveyItem(items[key])) return false;
  }
  return true;
}

export function isSurveyDraftV3(data: unknown): data is SurveyDraftV3 {
  if (!data || typeof data !== "object") return false;
  const o = data as { schemaVersion?: unknown; items?: unknown };
  if (o.schemaVersion !== 3) return false;
  if (!o.items || typeof o.items !== "object" || Array.isArray(o.items)) {
    return false;
  }
  const items = o.items as Record<string, unknown>;
  const keys = Object.keys(items);
  if (keys.length < 1) return false;
  for (const key of keys) {
    if (!parseSurveySlot(key) || !isSurveyAnswer(items[key])) return false;
  }
  return true;
}

export function parseShareSurvey(data: unknown): ShareSurvey | null {
  if (typeof (data as { submittedAt?: unknown })?.submittedAt !== "string") {
    return null;
  }
  const submittedAt = (data as { submittedAt: string }).submittedAt;
  if (!submittedAt.trim()) return null;

  if (isSurveyDraftV3(data)) {
    return {
      schemaVersion: 3,
      submittedAt,
      items: data.items,
      images: parseImagesV3((data as { images?: unknown }).images),
    };
  }

  if (!isSurveyDraft(data)) return null;
  const images =
    data.schemaVersion === 2
      ? parseImagesV12((data as { images?: unknown }).images)
      : {};
  return {
    schemaVersion: data.schemaVersion,
    submittedAt,
    items: data.items,
    other: data.other,
    images,
  };
}

export function emptyQuestionDraft(): SurveyItemDraft {
  return { status: null, comment: "" };
}

export function surveyToQuestionDrafts(
  survey: ShareSurvey,
  ids: string[],
): Record<string, SurveyItemDraft> {
  const out: Record<string, SurveyItemDraft> = {};
  for (const id of ids) {
    if (survey.schemaVersion === 3) {
      const a = survey.items[id];
      out[id] = a
        ? { status: a.status ?? null, comment: a.comment }
        : emptyQuestionDraft();
    } else if (id === "other") {
      out[id] = { status: null, comment: survey.other };
    } else if (id === "dims" || id === "decor" || id === "facades") {
      out[id] = { ...survey.items[id] };
    } else {
      out[id] = emptyQuestionDraft();
    }
  }
  return out;
}

export function formToDraftV3(
  form: Record<string, SurveyItemDraft>,
  questions: Array<{ id: string; kind: "choice" | "note" }>,
): SurveyDraftV3 | null {
  const items: Record<string, SurveyAnswer> = {};
  for (const q of questions) {
    const row = form[q.id] ?? emptyQuestionDraft();
    if (q.kind === "choice") {
      if (row.status !== "ok" && row.status !== "not_ok") return null;
      items[q.id] = { status: row.status, comment: row.comment };
    } else {
      items[q.id] = { comment: row.comment };
    }
  }
  return { schemaVersion: 3, items };
}

export function validateShareSurvey(data: unknown): data is ShareSurvey {
  return parseShareSurvey(data) != null;
}
