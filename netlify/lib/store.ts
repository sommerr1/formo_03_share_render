import { getStore } from "@netlify/blobs";
import { SURVEY_SLOTS, type SurveySlot } from "./survey.js";
import type { RenderMeta } from "./types.js";

export type UploadSession = {
  createdAt: string;
  expiresAt: string;
  totalChunks: number;
  received: number[];
};

export const CHUNK_SIZE_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 150 * 1024 * 1024;
export const MAX_UPLOAD_CHUNKS = 64;

const STORE_NAME = "renders";

function glbKey(token: string): string {
  return `${token}.glb`;
}

function metaKey(token: string): string {
  return `${token}.meta.json`;
}

function overlayKey(token: string): string {
  return `${token}.overlay.json`;
}

function surveyKey(token: string): string {
  return `${token}.survey.json`;
}

function surveyImageKey(token: string, slot: SurveySlot): string {
  return `${token}.survey.${slot}.jpg`;
}

function partKey(token: string, index: number): string {
  return `${token}.part.${index}`;
}

function sessionKey(token: string): string {
  return `${token}.upload.json`;
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
    const meta: RenderMeta = {
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
    };
    if (typeof parsed.surveyEnabled === "boolean") {
      meta.surveyEnabled = parsed.surveyEnabled;
    }
    return meta;
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

export async function putUploadSession(
  token: string,
  session: UploadSession,
): Promise<void> {
  const store = renderStore();
  await store.set(sessionKey(token), JSON.stringify(session), {
    metadata: { contentType: "application/json" },
  });
}

export async function getUploadSession(
  token: string,
): Promise<UploadSession | null> {
  const store = renderStore();
  const raw = await store.get(sessionKey(token), { type: "text" });
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as UploadSession;
    if (
      typeof parsed.createdAt !== "string" ||
      typeof parsed.expiresAt !== "string" ||
      typeof parsed.totalChunks !== "number" ||
      !Array.isArray(parsed.received)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function waitForUploadSession(
  token: string,
): Promise<UploadSession | null> {
  const waitsMs = [0, 250, 500, 1000, 2000];
  for (const wait of waitsMs) {
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    const session = await getUploadSession(token);
    if (session) return session;
  }
  return null;
}

export async function putUploadPart(
  token: string,
  index: number,
  data: ArrayBuffer,
): Promise<void> {
  const store = renderStore();
  await store.set(partKey(token, index), data, {
    metadata: { contentType: "application/octet-stream" },
  });
}

export async function assembleAndFinalizeUpload(
  token: string,
): Promise<RenderMeta> {
  const session = await waitForUploadSession(token);
  if (!session) throw new Error("Upload session not found");

  const store = renderStore();
  const parts: ArrayBuffer[] = [];
  let totalBytes = 0;
  for (let i = 0; i < session.totalChunks; i++) {
    const buf = await store.get(partKey(token, i), { type: "arrayBuffer" });
    if (!buf) throw new Error(`Missing chunk ${i}`);
    totalBytes += buf.byteLength;
    if (totalBytes > MAX_UPLOAD_BYTES) {
      throw new Error("File too large");
    }
    parts.push(buf);
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const part of parts) {
    merged.set(new Uint8Array(part), offset);
    offset += part.byteLength;
  }

  const existing = await getRenderMeta(token);
  const meta: RenderMeta = {
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  };
  if (typeof existing?.surveyEnabled === "boolean") {
    meta.surveyEnabled = existing.surveyEnabled;
  }
  await putRender(token, merged.buffer, meta);
  await deleteUploadArtifacts(token);
  return meta;
}

export async function deleteUploadParts(token: string): Promise<void> {
  const store = renderStore();
  const { blobs } = await store.list({ prefix: `${token}.part.` });
  for (const blob of blobs) {
    await store.delete(blob.key);
  }
}

export async function deleteUploadArtifacts(token: string): Promise<void> {
  const store = renderStore();
  const session = await getUploadSession(token);
  await store.delete(sessionKey(token));
  if (session) {
    for (let i = 0; i < session.totalChunks; i++) {
      await store.delete(partKey(token, i));
    }
  }
  await deleteUploadParts(token);
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

export async function getRenderOverlay(
  token: string,
): Promise<string | null> {
  const store = renderStore();
  return store.get(overlayKey(token), { type: "text" });
}

export async function putRenderOverlay(
  token: string,
  json: string,
): Promise<void> {
  const store = renderStore();
  await store.set(overlayKey(token), json, {
    metadata: { contentType: "application/json" },
  });
}

export async function getRenderSurvey(
  token: string,
): Promise<string | null> {
  const store = renderStore();
  return store.get(surveyKey(token), { type: "text" });
}

export async function putRenderSurvey(
  token: string,
  json: string,
): Promise<void> {
  const store = renderStore();
  await store.set(surveyKey(token), json, {
    metadata: { contentType: "application/json" },
  });
}

export async function getRenderSurveyImage(
  token: string,
  slot: SurveySlot,
): Promise<ArrayBuffer | null> {
  const store = renderStore();
  return store.get(surveyImageKey(token, slot), { type: "arrayBuffer" });
}

export async function putRenderSurveyImage(
  token: string,
  slot: SurveySlot,
  data: ArrayBuffer,
): Promise<void> {
  const store = renderStore();
  await store.set(surveyImageKey(token, slot), data, {
    metadata: { contentType: "image/jpeg" },
  });
}

export async function listSurveyImageFlags(
  token: string,
): Promise<Partial<Record<SurveySlot, true>>> {
  const images: Partial<Record<SurveySlot, true>> = {};
  for (const slot of SURVEY_SLOTS) {
    const buf = await getRenderSurveyImage(token, slot);
    if (buf && buf.byteLength > 0) images[slot] = true;
  }
  return images;
}

async function deleteRenderSurveyImages(token: string): Promise<void> {
  const store = renderStore();
  for (const slot of SURVEY_SLOTS) {
    await store.delete(surveyImageKey(token, slot));
  }
}

export async function deleteRender(token: string): Promise<void> {
  const store = renderStore();
  await store.delete(glbKey(token));
  await store.delete(metaKey(token));
  await store.delete(overlayKey(token));
  await store.delete(surveyKey(token));
  await deleteRenderSurveyImages(token);
  await deleteUploadArtifacts(token);
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
