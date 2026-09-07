import { Color, type Mesh, type MeshStandardMaterial, type Object3D } from "three";

export function exposureFromLuma(luma: number): number {
  const t = Math.min(1, Math.max(0, luma));
  return 0.45 + 0.7 * (1 - t);
}

export const STUDIO_KEY_COLOR = "#fff5e6";
export const STUDIO_FILL_COLOR = "#dce6ff";

export function applySaturation(root: Object3D, on: boolean): void {
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const std = mat as MeshStandardMaterial;
      if (!std.color) continue;
      const data = std.userData as { formoBaseColor?: Color };
      if (!data.formoBaseColor) data.formoBaseColor = std.color.clone();
      const base = data.formoBaseColor;
      if (!on) {
        std.color.copy(base);
        continue;
      }
      const hsl = { h: 0, s: 0, l: 0 };
      base.getHSL(hsl);
      std.color.setHSL(hsl.h, Math.min(1, hsl.s * 1.28), hsl.l);
    }
  });
}

export function applyPhotoLook(root: Object3D, on: boolean): void {
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const std = mat as MeshStandardMaterial;
      if (typeof std.roughness !== "number") continue;
      const data = std.userData as {
        formoBaseRough?: number;
        formoBaseEnv?: number;
      };
      if (data.formoBaseRough == null) data.formoBaseRough = std.roughness;
      if (data.formoBaseEnv == null) data.formoBaseEnv = std.envMapIntensity ?? 1;
      if (on) {
        std.roughness = Math.min(1, data.formoBaseRough + 0.2);
        std.envMapIntensity = data.formoBaseEnv * 0.25;
      } else {
        std.roughness = data.formoBaseRough;
        std.envMapIntensity = data.formoBaseEnv;
      }
      std.needsUpdate = true;
    }
  });
}