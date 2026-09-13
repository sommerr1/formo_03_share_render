import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { downloadShareGlb } from "../viewer/downloadGlb.js";
import { parseShareOverlay, type ShareOverlayV1 } from "../viewer/overlayTypes.js";
import { GlbViewer } from "../viewer/GlbViewer.js";
import {
  resolveShareBgColor,
  resolveShareViewerTools,
  type ShareViewerTools,
} from "../viewer/viewerTools.js";
import { NotFoundPage } from "./NotFoundPage.js";

type LoadState =
  | { kind: "loading" }
  | { kind: "notFound" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      url: string;
      overlay: ShareOverlayV1 | null;
      tools: ShareViewerTools;
      token: string;
      bgColor: string;
    };

export function ViewerPage() {
  const { token } = useParams();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [loadHint, setLoadHint] = useState("Загрузка модели…");

  useEffect(() => {
    if (!token) {
      setState({ kind: "notFound" });
      return;
    }

    let revoked = false;
    let objectUrl: string | null = null;

    (async () => {
      setState({ kind: "loading" });
      setLoadHint("Загрузка модели…");
      try {
        const metaRes = await fetch(`/api/models/${encodeURIComponent(token)}`);
        if (metaRes.status === 404) {
          if (!revoked) setState({ kind: "notFound" });
          return;
        }
        if (!metaRes.ok) {
          throw new Error(`meta ${metaRes.status}`);
        }
        let tools = resolveShareViewerTools({});
        let metaBody: Record<string, unknown> = {};
        try {
          metaBody = (await metaRes.json()) as Record<string, unknown>;
          tools = resolveShareViewerTools(metaBody);
        } catch {
          tools = resolveShareViewerTools({});
        }

        let blob: Blob;
        try {
          blob = await downloadShareGlb(token, metaBody, (p) => {
            if (!revoked) {
              setLoadHint(`Загрузка ${p.chunk}/${p.total}…`);
            }
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Load failed";
          if (msg.includes("404") || msg === "file missing") {
            if (!revoked) setState({ kind: "notFound" });
            return;
          }
          throw err;
        }
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

        if (!revoked) {
          setState({
            kind: "ready",
            url: objectUrl,
            overlay,
            tools,
            token,
            bgColor: resolveShareBgColor(metaBody),
          });
        }
      } catch (err) {
        if (!revoked) {
          const raw = err instanceof Error ? err.message : "Load failed";
          const message =
            raw === "Failed to fetch" || raw.includes("NetworkError")
              ? "Не удалось загрузить модель. Обновите страницу — при VPN загрузка идёт частями по 1 MB."
              : raw;
          setState({
            kind: "error",
            message,
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
        return <p className="status">{loadHint}</p>;
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
            <GlbViewer
              url={state.url}
              overlay={state.overlay}
              tools={state.tools}
              token={state.token}
              bgColor={state.bgColor}
            />
          </Suspense>
        );
    }
  }, [state, loadHint]);

  if (state.kind === "notFound") return <NotFoundPage />;

  return <main className="page page--viewer">{body}</main>;
}
