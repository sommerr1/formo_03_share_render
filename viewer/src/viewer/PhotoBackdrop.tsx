import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  LinearFilter,
  PerspectiveCamera,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  type Mesh,
} from "three";
import { containPlaneSize, PHOTO_BG_FLAG } from "./photoBg.js";

function noopRaycast(): void {}

function fitPhotoPlane(
  mesh: Mesh,
  camera: PerspectiveCamera,
  texture: Texture,
  viewAspect: number,
): void {
  const img = texture.image as { width: number; height: number } | undefined;
  if (!img?.width || !img.height) return;
  const dist = camera.near + 0.02;
  mesh.position.set(0, 0, -dist);
  const vFov = (camera.fov * Math.PI) / 180;
  const viewH = 2 * Math.tan(vFov / 2) * dist;
  const viewW = viewH * viewAspect;
  const { w, h } = containPlaneSize(viewW, viewH, img.width, img.height);
  mesh.scale.set(w, h, 1);
}

export function PhotoBackdrop({ url }: { url: string }) {
  const { camera, size } = useThree();
  const meshRef = useRef<Mesh>(null);
  const [texture, setTexture] = useState<Texture | null>(null);
  const viewAspect = size.width / Math.max(size.height, 1);

  useEffect(() => {
    let disposed = false;
    const loader = new TextureLoader();
    loader.load(url, (tex) => {
      if (disposed) {
        tex.dispose();
        return;
      }
      tex.colorSpace = SRGBColorSpace;
      tex.minFilter = LinearFilter;
      tex.magFilter = LinearFilter;
      tex.needsUpdate = true;
      setTexture(tex);
    });
    return () => {
      disposed = true;
      setTexture((prev) => {
        prev?.dispose();
        return null;
      });
    };
  }, [url]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !texture) return;
    fitPhotoPlane(mesh, camera as PerspectiveCamera, texture, viewAspect);
  }, [camera, texture, viewAspect]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || !texture) return;
    fitPhotoPlane(mesh, camera as PerspectiveCamera, texture, viewAspect);
  });

  if (!texture) return null;

  return createPortal(
    <mesh
      ref={meshRef}
      frustumCulled={false}
      renderOrder={-1000}
      raycast={noopRaycast}
      castShadow={false}
      receiveShadow={false}
      userData={{ [PHOTO_BG_FLAG]: true }}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>,
    camera,
  );
}
