import { useLayoutEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Bounds, Environment, OrbitControls, useGLTF } from "@react-three/drei";
import type { Material, Mesh, Object3D } from "three";
import { AnimLayer } from "./AnimLayer.js";
import { DimsLayer } from "./DimsLayer.js";
import {
  FORMO_FACADES_GROUP,
  type ShareOverlayV1,
} from "./overlayTypes.js";
import { SurveyPanel } from "./SurveyPanel.js";

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

function SceneContent({
  url,
  overlay,
  showFacades,
  showDims,
  xRay,
}: {
  url: string;
  overlay: ShareOverlayV1 | null;
  showFacades: boolean;
  showDims: boolean;
  xRay: boolean;
}) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const dims = overlay
    ? showFacades
      ? overlay.dims.withFacades
      : overlay.dims.withoutFacades
    : [];

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
          {overlay ? (
            <AnimLayer
              root={cloned}
              actors={overlay.actors}
              facadesOn={showFacades}
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

type Props = {
  url: string;
  overlay: ShareOverlayV1 | null;
  surveyEnabled: boolean;
  token: string;
};

export function GlbViewer({ url, overlay, surveyEnabled, token }: Props) {
  const [showFacades, setShowFacades] = useState(true);
  const [showDims, setShowDims] = useState(false);
  const [xRay, setXRay] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const hasOverlay = overlay != null;

  return (
    <div className="viewer-canvas">
      {surveyEnabled ? (
        <div className="viewer-survey">
          <button
            type="button"
            className={surveyOpen ? "viewer-survey-tag is-active" : "viewer-survey-tag"}
            aria-pressed={surveyOpen}
            onClick={() => setSurveyOpen((v) => !v)}
          >
            Опрос
          </button>
          {surveyOpen ? <SurveyPanel token={token} /> : null}
        </div>
      ) : null}
      <div className="viewer-toolbar">
        {hasOverlay ? (
          <button
            type="button"
            className={showFacades ? "is-active" : undefined}
            aria-pressed={showFacades}
            onClick={() => setShowFacades((v) => !v)}
          >
            Фасады
          </button>
        ) : null}
        {hasOverlay ? (
          <button
            type="button"
            className={showDims ? "is-active" : undefined}
            aria-pressed={showDims}
            onClick={() => setShowDims((v) => !v)}
          >
            Размеры
          </button>
        ) : null}
        <button
          type="button"
          className={xRay ? "is-active" : undefined}
          aria-pressed={xRay}
          onClick={() => setXRay((v) => !v)}
        >
          Xray
        </button>
      </div>
      <Canvas
        camera={{ fov: 45, near: 0.05, far: 2000, position: [4, 3, 5] }}
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true }}
        style={{ width: "100%", height: "100%", display: "block", background: "#000" }}
      >
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.22} />
        <directionalLight castShadow intensity={0.8} position={[6, 10, 5]} />
        <Environment preset="warehouse" environmentIntensity={0.4} />
        <SceneContent
          url={url}
          overlay={overlay}
          showFacades={showFacades}
          showDims={showDims}
          xRay={xRay}
        />
        <OrbitControls makeDefault enableDamping />
      </Canvas>
    </div>
  );
}
