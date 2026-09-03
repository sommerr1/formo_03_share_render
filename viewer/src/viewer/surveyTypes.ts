export type SurveyStatus = "ok" | "not_ok";

export type SurveyItem = {
  status: SurveyStatus;
  comment: string;
};

export const SURVEY_ITEM_KEYS = ["dims", "decor", "facades"] as const;
export const SURVEY_SLOTS = ["dims", "decor", "facades", "other"] as const;
export type SurveySlot = (typeof SURVEY_SLOTS)[number];

export type ShareSurvey = {
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

export type ShareSurveyV1 = ShareSurvey;

export type SurveyDraft = {
  schemaVersion: 1 | 2;
  items: ShareSurvey["items"];
  other: string;
};

export type SurveyItemDraft = {
  status: SurveyStatus | null;
  comment: string;
};

export type SurveyFormDraft = {
  items: {
    dims: SurveyItemDraft;
    decor: SurveyItemDraft;
    facades: SurveyItemDraft;
  };
  other: string;
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

function parseImages(v: unknown): Partial<Record<SurveySlot, true>> {
  if (!v || typeof v !== "object") return {};
  const out: Partial<Record<SurveySlot, true>> = {};
  const rec = v as Record<string, unknown>;
  for (const slot of SURVEY_SLOTS) {
    if (rec[slot] === true) out[slot] = true;
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

export function parseShareSurvey(data: unknown): ShareSurvey | null {
  if (!isSurveyDraft(data)) return null;
  if (typeof (data as { submittedAt?: unknown }).submittedAt !== "string") {
    return null;
  }
  const submittedAt = (data as ShareSurvey).submittedAt;
  if (!submittedAt.trim()) return null;
  const images =
    data.schemaVersion === 2
      ? parseImages((data as { images?: unknown }).images)
      : {};
  return {
    schemaVersion: data.schemaVersion,
    submittedAt,
    items: data.items,
    other: data.other,
    images,
  };
}

export function emptySurveyForm(): SurveyFormDraft {
  const blank = (): SurveyItemDraft => ({ status: null, comment: "" });
  return {
    items: { dims: blank(), decor: blank(), facades: blank() },
    other: "",
  };
}

export function surveyToForm(survey: ShareSurvey): SurveyFormDraft {
  return {
    items: {
      dims: { ...survey.items.dims },
      decor: { ...survey.items.decor },
      facades: { ...survey.items.facades },
    },
    other: survey.other,
  };
}

export function formToDraft(form: SurveyFormDraft): SurveyDraft | null {
  const items = {} as SurveyDraft["items"];
  for (const key of SURVEY_ITEM_KEYS) {
    const item = form.items[key];
    if (item.status !== "ok" && item.status !== "not_ok") return null;
    items[key] = { status: item.status, comment: item.comment };
  }
  return { schemaVersion: 2, items, other: form.other };
}

export function validateShareSurvey(data: unknown): data is ShareSurvey {
  return parseShareSurvey(data) != null;
}
