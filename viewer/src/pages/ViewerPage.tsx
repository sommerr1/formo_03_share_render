import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { parseShareOverlay, type ShareOverlayV1 } from "../viewer/overlayTypes.js";
import { GlbViewer } from "../viewer/GlbViewer.js";
import { NotFoundPage } from "./NotFoundPage.js";

type LoadState =
  | { kind: "loading" }
  | { kind: "notFound" }
  | { kind: "error"; message: string }
  | { kind: "ready"; url: string; overlay: ShareOverlayV1 | null };

export function ViewerPage() {
  const { token } = useParams();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "notFound" });
      return;
    }

    let revoked = false;
    let objectUrl: string | null = null;

    (async () => {
      setState({ kind: "loading" });
      try {
        const metaRes = await fetch(`/api/models/${encodeURIComponent(token)}`);
        if (metaRes.status === 404) {
          if (!revoked) setState({ kind: "notFound" });
          return;
        }
        if (!metaRes.ok) {
          throw new Error(`meta ${metaRes.status}`);
        }

        const fileRes = await fetch(
          `/api/models/${encodeURIComponent(token)}/file`,
        );
        if (fileRes.status === 404) {
          if (!revoked) setState({ kind: "notFound" });
          return;
        }
        if (!fileRes.ok) {
          throw new Error(`file ${fileRes.status}`);
        }

        const blob = await fileRes.blob();
        objectUrl = URL.createObjectURL(blob);

        let overlay: ShareOverlayV1 | null = null;
        const overlayRes = await fetch(
          `/api/models/${encodeURIComponent(token)}/overlay`,
        );
        if (overlayRes.ok) {
          try {
            overlay = parseShareOverlay(await overlayRes.json());
          } catch {
            overlay = null;
          }
        }

        if (!revoked) setState({ kind: "ready", url: objectUrl, overlay });
      } catch (err) {
        if (!revoked) {
          setState({
            kind: "error",
            message: err instanceof Error ? err.message : "Load failed",
          });
        }
      }
    })();

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token]);

  useEffect(() => {
    if (state.kind === "ready") document.title = "Formo Share Render";
  }, [state.kind]);

  const body = useMemo(() => {
    switch (state.kind) {
      case "loading":
        return <p className="status">Загрузка модели…</p>;
      case "error":
        return (
          <div className="status status--warn">
            <h1>Ошибка</h1>
            <p>{state.message}</p>
          </div>
        );
      case "ready":
        return (
          <Suspense fallback={<p className="status">Подготовка сцены…</p>}>
            <GlbViewer url={state.url} overlay={state.overlay} />
          </Suspense>
        );
    }
  }, [state]);

  if (state.kind === "notFound") return <NotFoundPage />;

  return <main className="page page--viewer">{body}</main>;
}
