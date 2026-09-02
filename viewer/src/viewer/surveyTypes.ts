export type SurveyStatus = "ok" | "not_ok";

export type SurveyItem = {
  status: SurveyStatus;
  comment: string;
};

export type ShareSurveyV1 = {
  schemaVersion: 1;
  submittedAt: string;
  items: {
    dims: SurveyItem;
    decor: SurveyItem;
    facades: SurveyItem;
  };
  other: string;
};

export type SurveyDraft = {
  schemaVersion: 1;
  items: ShareSurveyV1["items"];
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

export const SURVEY_ITEM_KEYS = ["dims", "decor", "facades"] as const;

export const SURVEY_QUESTIONS: Record<(typeof SURVEY_ITEM_KEYS)[number], string> = {
  dims: "Все ли в порядке с размерами, если нет, то что конкретно?",
  decor: "Все ли в порядке с декором и сочетаниями цветов, если нет, то что конкретно?",
  facades: "Все ли в порядке с фасадами, если нет, то что конкретно?",
};

export const SURVEY_OTHER_QUESTION =
  "Есть ли ещё какие-нибудь комментарии или замечания?";

function isSurveyItem(v: unknown): v is SurveyItem {
  if (!v || typeof v !== "object") return false;
  const o = v as { status?: unknown; comment?: unknown };
  if (o.status !== "ok" && o.status !== "not_ok") return false;
  if (typeof o.comment !== "string") return false;
  if (o.status === "not_ok" && o.comment.trim().length === 0) return false;
  return true;
}

export function isSurveyDraft(data: unknown): data is SurveyDraft {
  if (!data || typeof data !== "object") return false;
  const o = data as {
    schemaVersion?: unknown;
    items?: unknown;
    other?: unknown;
  };
  if (o.schemaVersion !== 1) return false;
  if (typeof o.other !== "string") return false;
  if (!o.items || typeof o.items !== "object") return false;
  const items = o.items as Record<string, unknown>;
  for (const key of SURVEY_ITEM_KEYS) {
    if (!isSurveyItem(items[key])) return false;
  }
  return true;
}

export function parseShareSurvey(data: unknown): ShareSurveyV1 | null {
  if (!isSurveyDraft(data)) return null;
  if (typeof (data as { submittedAt?: unknown }).submittedAt !== "string") {
    return null;
  }
  const submittedAt = (data as ShareSurveyV1).submittedAt;
  if (!submittedAt.trim()) return null;
  return {
    schemaVersion: 1,
    submittedAt,
    items: data.items,
    other: data.other,
  };
}

export function emptySurveyForm(): SurveyFormDraft {
  const blank = (): SurveyItemDraft => ({ status: null, comment: "" });
  return {
    items: { dims: blank(), decor: blank(), facades: blank() },
    other: "",
  };
}

export function surveyToForm(survey: ShareSurveyV1): SurveyFormDraft {
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
    if (item.status === "not_ok" && item.comment.trim().length === 0) return null;
    items[key] = { status: item.status, comment: item.comment };
  }
  return { schemaVersion: 1, items, other: form.other };
}

export function validateShareSurvey(data: unknown): data is ShareSurveyV1 {
  return parseShareSurvey(data) != null;
}
