import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { downloadShareGlb } from "../viewer/downloadGlb.js";
import { parseShareOverlay, type ShareOverlayV1 } from "../viewer/overlayTypes.js";
import { parsePromoManifest, type PromoManifest } from "../viewer/promoManifest.js";
import { PromoViewerUI } from "../viewer/PromoViewerUI.js";
import {
  parsePromoContentScope,
  promoShowModelActions,
} from "../viewer/promoActions.js";
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
  const [searchParams] = useSearchParams();
  const isDebugLog = searchParams.get("log") === "1" || searchParams.has("debug");
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string, data?: unknown) => {
    const time = new Date().toISOString().split("T")[1]?.slice(0, 8);
    const dataStr = data !== undefined ? ` | ${JSON.stringify(data)}` : "";
    const logLine = `[${time}] ${msg}${dataStr}`;
    console.log(`[ViewerLog] ${logLine}`);
    setLogs((prev) => [...prev, logLine]);
  };

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [loadHint, setLoadHint] = useState("Загрузка страницы…");
  const [promoDownloadBusy, setPromoDownloadBusy] = useState(false);

  const load3dModel = useCallback(async (metaBody: Record<string, unknown>, currentToken: string) => {
    addLog("load3dModel called", { token: currentToken });
    setLoadHint("Загрузка 3D модели…");
    setState({ kind: "loading" });
    try {
      const blob = await downloadShareGlb(currentToken, metaBody, (p) => {
        setLoadHint(`Загрузка 3D ${p.chunk}/${p.total}…`);
      });
      addLog("3D GLB blob downloaded", { size: blob.size, type: blob.type });
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
      addLog("3D Load error", raw);
      setState({
        kind: "error",
        message: `Не удалось загрузить 3D модель: ${raw}`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- addLog is debug-only
  }, []);

  const downloadPromoGlb = useCallback(
    async (metaBody: Record<string, unknown>, currentToken: string) => {
      if (promoDownloadBusy) return;
      setPromoDownloadBusy(true);
      try {
        const blob = await downloadShareGlb(currentToken, metaBody);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "formo-model.glb";
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        addLog("Promo GLB download error", err instanceof Error ? err.message : String(err));
      } finally {
        setPromoDownloadBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- addLog is debug-only
    [promoDownloadBusy],
  );

  useEffect(() => {
    addLog("ViewerPage mounted/updated", { token, isDebugLog });
    if (!token) {
      addLog("No token in params -> notFound");
      setState({ kind: "notFound" });
      return;
    }

    let revoked = false;

    (async () => {
      setState({ kind: "loading" });
      setLoadHint("Загрузка данных…");
      try {
        const metaUrl = `/api/models/${encodeURIComponent(token)}`;
        addLog("Fetching meta from", metaUrl);
        const metaRes = await fetch(metaUrl, { cache: "no-store" });
        addLog("Meta response status", { status: metaRes.status, ok: metaRes.ok });

        if (metaRes.status === 404) {
          addLog("Meta returned 404 -> notFound");
          if (!revoked) setState({ kind: "notFound" });
          return;
        }
        if (!metaRes.ok) {
          throw new Error(`meta status ${metaRes.status}`);
        }
        trackShareVisit(token);
        let metaBody: Record<string, unknown> = {};
        try {
          metaBody = (await metaRes.json()) as Record<string, unknown>;
          addLog("Meta body received", metaBody);
        } catch (e) {
          addLog("Error parsing meta JSON", String(e));
          metaBody = {};
        }

        const tools = resolveShareViewerTools(metaBody);
        const shareMode = metaBody.shareMode;
        const rawPromo = metaBody.promoManifest;
        const promoManifest = parsePromoManifest(rawPromo) ?? {
          frames: [],
          allow3D: metaBody.allow3D !== false,
        };

        addLog("Parsed meta params", {
          shareMode,
          rawPromoType: typeof rawPromo,
          parsedFramesCount: promoManifest.frames?.length,
          allow3D: promoManifest.allow3D,
        });

        // 1) Режим Промо: галерея; 3D — по клику (или сразу для model_only)
        if (shareMode === "promo") {
          const scope = parsePromoContentScope(metaBody);
          const framesCount = promoManifest.frames?.length ?? 0;
          addLog("Entering PROMO mode state", { scope, framesCount });

          if (scope === "model_only" || (scope === undefined && framesCount === 0)) {
            addLog("Promo model_only / no frames -> load 3D");
            if (!revoked) {
              await load3dModel(metaBody, token);
            }
            return;
          }

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

        addLog("Entering 3D mode state (shareMode != promo)", { shareMode });

        // 2) Обычный 3D режим (или Promo без галереи кадров)
        let blob: Blob;
        try {
          blob = await downloadShareGlb(token, metaBody, (p) => {
            if (!revoked) {
              setLoadHint(`Загрузка ${p.chunk}/${p.total}…`);
            }
          });
          addLog("Downloaded 3D GLB blob", { size: blob.size });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Load failed";
          addLog("Error downloading GLB", msg);
          if (msg.includes("404") || msg === "file missing") {
            if (!revoked) setState({ kind: "notFound" });
            return;
          }
          throw err;
        }
        const objectUrl = URL.createObjectURL(blob);

        let overlay: ShareOverlayV1 | null = null;
        if (metaBody.allow3D !== false) {
          addLog("Fetching overlay...");
          const overlayRes = await fetch(
            `/api/models/${encodeURIComponent(token)}/overlay`,
          );
          addLog("Overlay status", overlayRes.status);
          if (overlayRes.ok) {
            try {
              overlay = parseShareOverlay(await overlayRes.json());
            } catch {
              overlay = null;
            }
          }
        }

        if (!revoked) {
          addLog("Entering READY state for 3D");
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
          addLog("Catch error in load effect", raw);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per token
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
      case "promo": {
        const scope = parsePromoContentScope(state.metaBody);
        const showModel = promoShowModelActions({
          scope,
          framesCount: state.manifest.frames.length,
          allow3D: state.manifest.allow3D,
          meta: state.metaBody,
        });
        return (
          <PromoViewerUI
            manifest={state.manifest}
            showLoad3D={showModel}
            showDownload={showModel && state.tools.glbAr}
            downloadBusy={promoDownloadBusy}
            onLoad3D={() => load3dModel(state.metaBody, state.token)}
            onDownloadGlb={() => downloadPromoGlb(state.metaBody, state.token)}
          />
        );
      }
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
  }, [state, loadHint, load3dModel, downloadPromoGlb, promoDownloadBusy]);

  if (state.kind === "notFound") return <NotFoundPage />;

  return (
    <main className="page page--viewer" style={{ position: "relative" }}>
      {body}
      {isDebugLog && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            maxHeight: "40vh",
            overflowY: "auto",
            background: "rgba(0, 0, 0, 0.92)",
            color: "#00ff66",
            fontFamily: "monospace",
            fontSize: "12px",
            padding: "10px",
            zIndex: 99999,
            borderTop: "2px solid #00ff66",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <strong>🔍 Debug Log (?log=1):</strong>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(logs.join("\n"))}
              style={{
                background: "#00ff66",
                color: "#000",
                border: "none",
                padding: "2px 8px",
                borderRadius: "3px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Копировать логи
            </button>
          </div>
          {logs.map((log, i) => (
            <div key={i} style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {log}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
