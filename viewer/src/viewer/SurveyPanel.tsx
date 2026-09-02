import { useEffect, useState } from "react";
import {
  SURVEY_ITEM_KEYS,
  SURVEY_OTHER_QUESTION,
  SURVEY_QUESTIONS,
  emptySurveyForm,
  formToDraft,
  parseShareSurvey,
  surveyToForm,
  type SurveyFormDraft,
  type SurveyStatus,
} from "./surveyTypes.js";

type Props = {
  token: string;
};

export function SurveyPanel({ token }: Props) {
  const [form, setForm] = useState<SurveyFormDraft>(() => emptySurveyForm());
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let revoked = false;
    (async () => {
      try {
        const res = await fetch(`/api/models/${encodeURIComponent(token)}/survey`);
        if (res.status === 404) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const parsed = parseShareSurvey(await res.json());
        if (!revoked && parsed) setForm(surveyToForm(parsed));
      } catch {
        if (!revoked) setStatus("Не удалось загрузить ответы");
      }
    })();
    return () => {
      revoked = true;
    };
  }, [token]);

  const draft = formToDraft(form);

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

  const submit = async () => {
    const body = formToDraft(form);
    if (!body || busy) return;
    setBusy(true);
    setStatus(null);
    try {
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

  return (
    <form
      className="viewer-survey-panel"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {SURVEY_ITEM_KEYS.map((key) => {
        const item = form.items[key];
        return (
          <fieldset key={key} className="viewer-survey-q">
            <legend>{SURVEY_QUESTIONS[key]}</legend>
            <div className="viewer-survey-radios">
              <label>
                <input
                  type="radio"
                  name={`survey-${key}`}
                  checked={item.status === "ok"}
                  onChange={() => setItem(key, { status: "ok" as SurveyStatus })}
                />
                Ок
              </label>
              <label>
                <input
                  type="radio"
                  name={`survey-${key}`}
                  checked={item.status === "not_ok"}
                  onChange={() => setItem(key, { status: "not_ok" as SurveyStatus })}
                />
                Не ок
              </label>
            </div>
            <textarea
              value={item.comment}
              onChange={(e) => setItem(key, { comment: e.target.value })}
              placeholder={item.status === "not_ok" ? "Что именно не так" : "Комментарий"}
              required={item.status === "not_ok"}
              rows={2}
            />
          </fieldset>
        );
      })}
      <label className="viewer-survey-q">
        {SURVEY_OTHER_QUESTION}
        <textarea
          value={form.other}
          onChange={(e) => {
            setForm((cur) => ({ ...cur, other: e.target.value }));
            setStatus(null);
          }}
          rows={3}
        />
      </label>
      <div className="viewer-survey-actions">
        <button type="submit" disabled={!draft || busy}>
          {busy ? "…" : "Отправить"}
        </button>
        {status ? <span className="viewer-survey-status">{status}</span> : null}
      </div>
    </form>
  );
}
