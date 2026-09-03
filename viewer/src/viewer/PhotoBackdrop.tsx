import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import {
  Color,
  PerspectiveCamera,
  Vector3,
  type Mesh,
  type Texture,
} from "three";
import { containPlaneSize, PHOTO_BG_FLAG } from "./photoBg.js";

function noopRaycast(): void {}

const _dir = new Vector3();
const _clear = new Color(0x000000);

function fitPhotoPlane(
  mesh: Mesh,
  camera: PerspectiveCamera,
  texture: Texture,
  viewAspect: number,
): void {
  const img = texture.image as { width: number; height: number } | undefined;
  if (!img?.width || !img.height) return;
  const span = Math.max(camera.far - camera.near, 0.05);
  const dist = camera.near + Math.min(0.2, span * 0.04);
  const vFov = (camera.fov * Math.PI) / 180;
  const viewH = 2 * Math.tan(vFov / 2) * dist;
  const viewW = viewH * viewAspect;
  const { w, h } = containPlaneSize(viewW, viewH, img.width, img.height);
  mesh.scale.set(w, h, 1);
  mesh.quaternion.copy(camera.quaternion);
  camera.getWorldDirection(_dir);
  mesh.position.copy(camera.position).addScaledVector(_dir, dist);
}

/** Keep WebGL clear transparent so the CSS photo shows through. */
export function PhotoClear() {
  const { gl, scene } = useThree();
  useFrame(() => {
    scene.background = null;
    gl.setClearColor(_clear, 0);
  });
  return null;
}

export function PhotoBackdrop({ texture }: { texture: Texture }) {
  const meshRef = useRef<Mesh>(null);
  const { camera, size } = useThree();
  const viewAspect = size.width / Math.max(size.height, 1);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    fitPhotoPlane(mesh, camera as PerspectiveCamera, texture, viewAspect);
  });

  return (
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
    </mesh>
  );
}
