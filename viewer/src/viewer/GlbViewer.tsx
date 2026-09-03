import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Bounds, OrbitControls, useGLTF } from "@react-three/drei";
import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
  type Material,
  type Mesh,
  type Object3D,
} from "three";
import { AnimLayer } from "./AnimLayer.js";
import { DimsLayer } from "./DimsLayer.js";
import {
  downloadBlob,
  exportArGlbWithoutFillers,
  sceneHasFillersGroup,
} from "./exportArGlb.js";
import {
  applySaturation,
  exposureFromLuma,
  STUDIO_FILL_COLOR,
  STUDIO_KEY_COLOR,
} from "./lights.js";
import { OverflowMenu } from "./OverflowMenu.js";
import {
  FORMO_FACADES_GROUP,
  FORMO_FILLERS_GROUP,
  pickOverlayDims,
  type ShareOverlayV1,
} from "./overlayTypes.js";
import { readPhotoFile } from "./photoBg.js";
import { SurveyPanel } from "./SurveyPanel.js";
import { overflowMenuVisible, type ShareViewerTools } from "./viewerTools.js";

const XRAY_OPACITY = 0.3;

function applyXRay(root: Object3D, on: boolean): void {
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const m = mat as Material & { opacity?: number; depthWrite?: boolean };
      if (typeof m.opacity !== "number") continue;
      if (m.transparent && m.opacity < 0.01) continue;
      m.transparent = on;
      m.opacity = on ? XRAY_OPACITY : 1;
      m.depthWrite = !on;
      m.needsUpdate = true;
    }
  });
}

function FacadeVisibility({
  root,
  showFacades,
  overlay,
}: {
  root: Object3D;
  showFacades: boolean;
  overlay: ShareOverlayV1 | null;
}) {
  useLayoutEffect(() => {
    let group: Object3D | undefined;
    root.traverse((o) => {
      if (o.name === FORMO_FACADES_GROUP) group = o;
    });
    if (group) {
      group.visible = showFacades;
      return;
    }
    if (!overlay) return;
    const ids = new Set(
      overlay.actors
        .filter((a) => a.kind === "facade")
        .map((a) => a.partId),
    );
    root.traverse((o) => {
      if (ids.has(o.name)) o.visible = showFacades;
    });
  }, [root, showFacades, overlay]);
  return null;
}

function FillerVisibility({
  root,
  showFillers,
}: {
  root: Object3D;
  showFillers: boolean;
}) {
  useLayoutEffect(() => {
    root.traverse((o) => {
      if (o.name === FORMO_FILLERS_GROUP) o.visible = showFillers;
    });
  }, [root, showFillers]);
  return null;
}

function SaturationSync({ root, on }: { root: Object3D; on: boolean }) {
  useLayoutEffect(() => {
    applySaturation(root, on);
  }, [root, on]);
  return null;
}

function SceneContent({
  url,
  overlay,
  showFacades,
  showFillers,
  showDims,
  xRay,
  frozen,
  satOn,
  sceneRootRef,
  onHasFillers,
}: {
  url: string;
  overlay: ShareOverlayV1 | null;
  showFacades: boolean;
  showFillers: boolean;
  showDims: boolean;
  xRay: boolean;
  frozen: boolean;
  satOn: boolean;
  sceneRootRef: MutableRefObject<Object3D | null>;
  onHasFillers: (v: boolean) => void;
}) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const dims = overlay
    ? pickOverlayDims(overlay, showFacades, showFillers)
    : [];

  useLayoutEffect(() => {
    sceneRootRef.current = cloned;
    onHasFillers(sceneHasFillersGroup(cloned));
  }, [cloned, onHasFillers, sceneRootRef]);

  return (
    <>
      <Bounds fit clip observe margin={1.2}>
        <group>
          <primitive object={cloned} />
          <FacadeVisibility
            root={cloned}
            showFacades={showFacades}
            overlay={overlay}
          />
          <FillerVisibility root={cloned} showFillers={showFillers} />
          <SaturationSync root={cloned} on={satOn} />
          {overlay ? (
            <AnimLayer
              root={cloned}
              actors={overlay.actors}
              facadesOn={showFacades}
              interactive={!frozen}
            />
          ) : null}
        </group>
      </Bounds>
      {showDims && dims.length > 0 ? <DimsLayer dims={dims} /> : null}
      <XRaySceneSync xRay={xRay} />
    </>
  );
}

function XRaySceneSync({ xRay }: { xRay: boolean }) {
  const { scene } = useThree();
  useLayoutEffect(() => {
    applyXRay(scene, xRay);
  }, [scene, xRay]);
  return null;
}

function GlCanvasBind({
  target,
}: {
  target: MutableRefObject<HTMLCanvasElement | null>;
}) {
  const { gl } = useThree();
  useLayoutEffect(() => {
    target.current = gl.domElement;
    gl.outputColorSpace = SRGBColorSpace;
    gl.toneMapping = ACESFilmicToneMapping;
  }, [gl, target]);
  return null;
}

function ClearAlpha({ transparent }: { transparent: boolean }) {
  const { gl } = useThree();
  useLayoutEffect(() => {
    gl.setClearColor(0x000000, transparent ? 0 : 1);
  }, [gl, transparent]);
  return null;
}

type Props = {
  url: string;
  overlay: ShareOverlayV1 | null;
  tools: ShareViewerTools;
  token: string;
};

export function GlbViewer({ url, overlay, tools, token }: Props) {
  const [showFacades, setShowFacades] = useState(true);
  const [showFillers, setShowFillers] = useState(false);
  const [hasFillers, setHasFillers] = useState(false);
  const [showDims, setShowDims] = useState(false);
  const [xRay, setXRay] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [satOn, setSatOn] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoLuma, setPhotoLuma] = useState(0.5);
  const [glbBusy, setGlbBusy] = useState(false);
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;
  const freezeBeforeSurveyRef = useRef(false);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRootRef = useRef<Object3D | null>(null);
  const photoUrlRef = useRef<string | null>(null);
  const hasOverlay = overlay != null;
  const lightK = photoUrl ? exposureFromLuma(photoLuma) : 1;

  useEffect(() => {
    return () => {
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    };
  }, []);

  const openSurvey = () => {
    freezeBeforeSurveyRef.current = frozenRef.current;
    if (!frozenRef.current) setFrozen(true);
    setSurveyOpen(true);
  };

  const closeSurvey = () => {
    setFrozen(freezeBeforeSurveyRef.current);
    setSurveyOpen(false);
  };

  const onPhotoFile = async (file: File) => {
    try {
      const next = await readPhotoFile(file);
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
      photoUrlRef.current = next.url;
      setPhotoUrl(next.url);
      setPhotoLuma(next.luma);
    } catch {
      /* ignore */
    }
  };

  const onPhotoClear = () => {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    photoUrlRef.current = null;
    setPhotoUrl(null);
  };

  const onDownloadGlb = async () => {
    if (glbBusy) return;
    setGlbBusy(true);
    try {
      const root = sceneRootRef.current;
      let blob: Blob;
      if (root && sceneHasFillersGroup(root)) {
        blob = await exportArGlbWithoutFillers(root);
      } else {
        const res = await fetch(`/api/models/${encodeURIComponent(token)}/file`);
        if (!res.ok) throw new Error(String(res.status));
        blob = await res.blob();
      }
      downloadBlob(blob, "formo-ar.glb");
    } catch {
      /* ignore */
    } finally {
      setGlbBusy(false);
    }
  };

  return (
    <div className="viewer-canvas">
      {photoUrl ? (
        <img className="viewer-photo-bg" src={photoUrl} alt="" />
      ) : null}
      {tools.survey ? (
        <>
          <div className="viewer-survey">
            <button
              type="button"
              className={surveyOpen ? "viewer-survey-tag is-active" : "viewer-survey-tag"}
              aria-pressed={surveyOpen}
              onClick={surveyOpen ? closeSurvey : openSurvey}
            >
              Опрос
            </button>
          </div>
          <SurveyPanel
            token={token}
            open={surveyOpen}
            frozen={frozen}
            glCanvasRef={glCanvasRef}
            annotateEnabled={tools.annotate}
          />
        </>
      ) : null}
      <div className={tools.survey ? "viewer-toolbar" : "viewer-toolbar viewer-toolbar--flush"}>
        {hasOverlay && tools.facades ? (
          <button
            type="button"
            className={showFacades ? "is-active" : undefined}
            aria-pressed={showFacades}
            onClick={() => setShowFacades((v) => !v)}
          >
            Фасады
          </button>
        ) : null}
        {hasOverlay && tools.dims ? (
          <button
            type="button"
            className={showDims ? "is-active" : undefined}
            aria-pressed={showDims}
            onClick={() => setShowDims((v) => !v)}
          >
            Размеры
          </button>
        ) : null}
        {tools.xray ? (
        <button
          type="button"
          className={xRay ? "is-active" : undefined}
          aria-pressed={xRay}
          onClick={() => setXRay((v) => !v)}
        >
          Xray
        </button>
        ) : null}
        {tools.freeze ? (
        <button
          type="button"
          className={frozen ? "is-active" : undefined}
          aria-pressed={frozen}
          title={frozen ? "Разморозить вид" : "Заморозить вид"}
          aria-label={frozen ? "Разморозить вид" : "Заморозить вид"}
          onClick={() => setFrozen((v) => !v)}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
            <rect
              x="4"
              y="7.2"
              width="8"
              height="6.4"
              rx="1.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.35"
            />
            <path
              d="M5.6 7.2V5.3a2.4 2.4 0 0 1 4.8 0v1.9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.35"
              strokeLinecap="round"
            />
          </svg>
        </button>
        ) : null}
        {overflowMenuVisible(tools) ? (
        <OverflowMenu
          hasFillers={hasFillers}
          showFillers={showFillers}
          onShowFillers={setShowFillers}
          satOn={satOn}
          onSatOn={setSatOn}
          hasPhoto={photoUrl != null}
          onPhotoFile={(f) => void onPhotoFile(f)}
          onPhotoClear={onPhotoClear}
          onDownloadGlb={() => void onDownloadGlb()}
          glbBusy={glbBusy}
          showGlbAr={tools.glbAr}
          showBgPhoto={tools.bgPhoto}
          showSat={tools.sat}
          showFillersToggle={tools.fillersToggle}
        />
        ) : null}
      </div>
      <Canvas
        camera={{ fov: 45, near: 0.05, far: 2000, position: [4, 3, 5] }}
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, preserveDrawingBuffer: true, alpha: true }}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          background: "transparent",
        }}
      >
        <ClearAlpha transparent={photoUrl != null} />
        {photoUrl ? null : <color attach="background" args={["#1a1d24"]} />}
        <ambientLight intensity={0.35 * lightK} color="#ffffff" />
        <directionalLight
          intensity={1.1 * lightK}
          color={STUDIO_KEY_COLOR}
          position={[6, 10, 5]}
        />
        <directionalLight
          intensity={0.35 * lightK}
          color={STUDIO_FILL_COLOR}
          position={[-5, 4, -3]}
        />
        <SceneContent
          url={url}
          overlay={overlay}
          showFacades={showFacades}
          showFillers={showFillers}
          showDims={showDims}
          xRay={xRay}
          frozen={frozen}
          satOn={satOn}
          sceneRootRef={sceneRootRef}
          onHasFillers={setHasFillers}
        />
        <GlCanvasBind target={glCanvasRef} />
        <OrbitControls makeDefault enableDamping enabled={!frozen} />
      </Canvas>
    </div>
  );
}
