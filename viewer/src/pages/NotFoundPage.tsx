import { useEffect, useMemo } from "react";

function isEdgeUa(): boolean {
  const ua = navigator.userAgent;
  return /Edg\//.test(ua) && !/OPR\//.test(ua);
}

function SadDocIcon() {
  return (
    <svg
      className="nx__icon"
      width="48"
      height="48"
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <path
        fill="#9aa0a6"
        d="M10 4h18l10 10v26a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z"
      />
      <path fill="#202124" d="M28 4v8a2 2 0 0 0 2 2h8" />
      <path fill="#9aa0a6" d="M28 4l10 10H30a2 2 0 0 1-2-2V4z" />
      <circle cx="18.5" cy="26" r="2.1" fill="#202124" />
      <circle cx="29.5" cy="26" r="2.1" fill="#202124" />
      <path
        fill="none"
        stroke="#202124"
        strokeWidth="2"
        strokeLinecap="round"
        d="M19 34c2.2-2.4 7.8-2.4 10 0"
      />
    </svg>
  );
}

export function NotFoundPage() {
  const edge = useMemo(() => isEdgeUa(), []);
  const host = window.location.host;

  useEffect(() => {
    const prev = document.title;
    document.title = host;
    document.documentElement.classList.add("nx-html");
    return () => {
      document.title = prev;
      document.documentElement.classList.remove("nx-html");
    };
  }, [host]);

  return (
    <main className={`nx${edge ? " nx--edge" : ""}`}>
      <div className="nx__inner">
        <SadDocIcon />
        <h1 className="nx__title">
          {edge
            ? "Не удается открыть эту страницу"
            : "Не удается получить доступ к сайту"}
        </h1>
        {edge ? (
          <p className="nx__lead">
            Проверьте, нет ли опечатки в <strong>{host}</strong>.
          </p>
        ) : (
          <>
            <p className="nx__lead">
              Проверьте, нет ли опечаток в имени хоста <strong>{host}</strong>.
            </p>
            <p className="nx__lead">
              Если все правильно, воспользуйтесь инструментом{" "}
              <a className="nx__link" href="ms-settings:network">
                Диагностика сетей Windows
              </a>
              .
            </p>
          </>
        )}
        <p className="nx__code">DNS_PROBE_FINISHED_NXDOMAIN</p>
        <button
          type="button"
          className="nx__reload"
          onClick={() => window.location.reload()}
        >
          {edge ? "Обновить" : "Перезагрузить"}
        </button>
      </div>
    </main>
  );
}
