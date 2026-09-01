import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Environment, OrbitControls, useGLTF } from "@react-three/drei";

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return (
    <Bounds fit clip observe margin={1.2}>
      <primitive object={cloned} />
    </Bounds>
  );
}

type Props = {
  url: string;
};

export function GlbViewer({ url }: Props) {
  return (
    <div className="viewer-canvas">
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
        <Model url={url} />
        <OrbitControls makeDefault enableDamping />
      </Canvas>
    </div>
  );
}
