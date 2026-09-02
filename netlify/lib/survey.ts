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

const ITEM_KEYS = ["dims", "decor", "facades"] as const;

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
  for (const key of ITEM_KEYS) {
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

export function surveySubmittedAtFromRaw(raw: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = parseShareSurvey(JSON.parse(raw));
    return parsed?.submittedAt;
  } catch {
    return undefined;
  }
}
