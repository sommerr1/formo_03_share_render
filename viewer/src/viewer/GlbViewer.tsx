import { Canvas } from "@react-three/fiber";
import { Center, Environment, OrbitControls, useGLTF } from "@react-three/drei";

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return (
    <Center>
      <primitive object={scene.clone()} />
    </Center>
  );
}

type Props = {
  url: string;
};

export function GlbViewer({ url }: Props) {
  return (
    <div className="viewer-canvas">
      <Canvas camera={{ position: [2.5, 2, 3.5], fov: 45 }} shadows>
        <color attach="background" args={["#eef1f4"]} />
        <ambientLight intensity={0.45} />
        <directionalLight castShadow intensity={1.1} position={[5, 8, 4]} />
        <Environment preset="apartment" />
        <Model url={url} />
        <OrbitControls makeDefault target={[0, 0.8, 0]} />
      </Canvas>
    </div>
  );
}
