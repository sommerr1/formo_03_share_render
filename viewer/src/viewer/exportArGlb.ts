import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { Object3D } from "three";
import { FORMO_FILLERS_GROUP } from "./overlayTypes.js";

export function sceneHasFillersGroup(root: Object3D): boolean {
  let found = false;
  root.traverse((o) => {
    if (o.name === FORMO_FILLERS_GROUP) found = true;
  });
  return found;
}

export async function exportArGlbWithoutFillers(root: Object3D): Promise<Blob> {
  const clone = root.clone(true);
  const doomed: Object3D[] = [];
  clone.traverse((o) => {
    if (o.name === FORMO_FILLERS_GROUP) doomed.push(o);
  });
  for (const o of doomed) o.parent?.remove(o);
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(clone, {
    binary: true,
    onlyVisible: false,
    embedImages: true,
  });
  if (!(result instanceof ArrayBuffer)) {
    throw new Error("GLTFExporter expected binary");
  }
  return new Blob([result], { type: "model/gltf-binary" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
