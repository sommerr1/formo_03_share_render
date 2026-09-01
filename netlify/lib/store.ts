import { getStore } from "@netlify/blobs";
import type { RenderMeta } from "./types.js";

const STORE_NAME = "renders";

function glbKey(token: string): string {
  return `${token}.glb`;
}

function metaKey(token: string): string {
  return `${token}.meta.json`;
}

export function renderStore() {
  return getStore(STORE_NAME);
}

export async function getRenderMeta(token: string): Promise<RenderMeta | null> {
  const store = renderStore();
  const raw = await store.get(metaKey(token), { type: "text" });
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RenderMeta;
    if (
      typeof parsed.createdAt !== "string" ||
      typeof parsed.expiresAt !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function putRender(
  token: string,
  glb: ArrayBuffer,
  meta: RenderMeta,
): Promise<void> {
  const store = renderStore();
  await store.set(glbKey(token), glb, {
    metadata: { contentType: "model/gltf-binary" },
  });
  await store.set(metaKey(token), JSON.stringify(meta), {
    metadata: { contentType: "application/json" },
  });
}

export async function patchRenderMeta(
  token: string,
  meta: RenderMeta,
): Promise<void> {
  const store = renderStore();
  await store.set(metaKey(token), JSON.stringify(meta), {
    metadata: { contentType: "application/json" },
  });
}

export async function getRenderGlb(token: string): Promise<ArrayBuffer | null> {
  const store = renderStore();
  return store.get(glbKey(token), { type: "arrayBuffer" });
}

export async function deleteRender(token: string): Promise<void> {
  const store = renderStore();
  await store.delete(glbKey(token));
  await store.delete(metaKey(token));
}

export async function purgeExpiredRenders(now = Date.now()): Promise<number> {
  const store = renderStore();
  const { blobs } = await store.list();
  let removed = 0;
  for (const item of blobs) {
    if (!item.key.endsWith(".meta.json")) continue;
    const raw = await store.get(item.key, { type: "text" });
    if (!raw) continue;
    try {
      const meta = JSON.parse(raw) as RenderMeta;
      if (new Date(meta.expiresAt).getTime() <= now) {
        const token = item.key.slice(0, -".meta.json".length);
        await deleteRender(token);
        removed += 1;
      }
    } catch {
      /* skip malformed */
    }
  }
  return removed;
}
