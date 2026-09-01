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
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <color attach="background" args={["#eef1f4"]} />
        <ambientLight intensity={0.55} />
        <directionalLight castShadow intensity={1.15} position={[6, 10, 5]} />
        <Environment preset="apartment" />
        <Model url={url} />
        <OrbitControls makeDefault enableDamping />
      </Canvas>
    </div>
  );
}
