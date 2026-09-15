import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { downloadShareGlb } from "../viewer/downloadGlb.js";
import { parseShareOverlay, type ShareOverlayV1 } from "../viewer/overlayTypes.js";
import { parsePromoManifest, type PromoManifest } from "../viewer/promoManifest.js";
import { PromoViewerUI } from "../viewer/PromoViewerUI.js";
import { GlbViewer } from "../viewer/GlbViewer.js";
import {
  resolveShareBgColor,
  resolveShareViewerTools,
  type ShareViewerTools,
} from "../viewer/viewerTools.js";
import { trackShareVisit } from "../viewer/trackVisit.js";
import { NotFoundPage } from "./NotFoundPage.js";

type LoadState =
  | { kind: "loading" }
  | { kind: "notFound" }
  | { kind: "error"; message: string }
  | {
      kind: "promo";
      manifest: PromoManifest;
      tools: ShareViewerTools;
      token: string;
      metaBody: Record<string, unknown>;
    }
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
  const [loadHint, setLoadHint] = useState("Загрузка страницы…");

  const load3dModel = async (metaBody: Record<string, unknown>, currentToken: string) => {
    setLoadHint("Загрузка 3D модели…");
    setState({ kind: "loading" });
    try {
      const blob = await downloadShareGlb(currentToken, metaBody, (p) => {
        setLoadHint(`Загрузка 3D ${p.chunk}/${p.total}…`);
      });
      const objectUrl = URL.createObjectURL(blob);
      let overlay: ShareOverlayV1 | null = null;

      const overlayRes = await fetch(
        `/api/models/${encodeURIComponent(currentToken)}/overlay`,
      );
      if (overlayRes.ok) {
        try {
          overlay = parseShareOverlay(await overlayRes.json());
        } catch {
          overlay = null;
        }
      }

      setState({
        kind: "ready",
        url: objectUrl,
        overlay,
        tools: resolveShareViewerTools(metaBody),
        token: currentToken,
        bgColor: resolveShareBgColor(metaBody),
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "3D Load failed";
      setState({
        kind: "error",
        message: `Не удалось загрузить 3D модель: ${raw}`,
      });
    }
  };

  useEffect(() => {
    if (!token) {
      setState({ kind: "notFound" });
      return;
    }

    let revoked = false;

    (async () => {
      setState({ kind: "loading" });
      setLoadHint("Загрузка данных…");
      try {
        const metaRes = await fetch(`/api/models/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        if (metaRes.status === 404) {
          if (!revoked) setState({ kind: "notFound" });
          return;
        }
        if (!metaRes.ok) {
          throw new Error(`meta ${metaRes.status}`);
        }
        trackShareVisit(token);
        let metaBody: Record<string, unknown> = {};
        try {
          metaBody = (await metaRes.json()) as Record<string, unknown>;
        } catch {
          metaBody = {};
        }

        const tools = resolveShareViewerTools(metaBody);
        const shareMode = metaBody.shareMode;
        const promoManifest = parsePromoManifest(metaBody.promoManifest);

        // 1) Режим Промо: загрузка сразу Галереи (3D загружается только по клику на кнопку)
        if (shareMode === "promo" && promoManifest) {
          if (!revoked) {
            setState({
              kind: "promo",
              manifest: promoManifest,
              tools,
              token,
              metaBody,
            });
          }
          return;
        }

        // 2) Обычный 3D режим (или Promo без галереи кадров)
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
        const objectUrl = URL.createObjectURL(blob);

        let overlay: ShareOverlayV1 | null = null;
        if (metaBody.allow3D !== false) {
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
              ? "Не удалось загрузить данные. Обновите страницу."
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
    };
  }, [token]);

  useEffect(() => {
    if (state.kind === "ready" || state.kind === "promo") {
      document.title = "Formo Share Render";
    }
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
      case "promo":
        return (
          <PromoViewerUI
            manifest={state.manifest}
            allow3D={state.manifest.allow3D}
            onLoad3D={() => load3dModel(state.metaBody, state.token)}
          />
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
