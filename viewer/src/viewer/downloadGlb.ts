/** Download slices — match server `DOWNLOAD_CHUNK_BYTES`. */
export const DOWNLOAD_CHUNK_BYTES = 1 * 1024 * 1024;

/** Above this size always use chunked download (VPN / proxy safe). */
export const VPN_CHUNK_THRESHOLD_BYTES = 1 * 1024 * 1024;

export type ShareGlbChunkPlan = {
  fileSizeBytes: number;
  chunkSize: number;
  totalChunks: number;
};

export type ShareGlbDownloadProgress = {
  chunk: number;
  total: number;
};

const NETWORK_RETRY_MS = [0, 600, 1500, 3000, 6000, 10_000, 15_000];

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return (
    msg === "Failed to fetch" ||
    msg.includes("NetworkError") ||
    msg.includes("network") ||
    err.name === "TypeError"
  );
}

async function fetchWithRetry(url: string): Promise<Response> {
  let lastRes: Response | null = null;
  let lastErr: unknown;
  for (const wait of NETWORK_RETRY_MS) {
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      const res = await fetch(url, { cache: "no-store" });
      lastRes = res;
      if (res.ok) return res;
      if (res.status !== 404 && res.status !== 409 && res.status < 500) {
        return res;
      }
    } catch (err) {
      lastErr = err;
      if (!isNetworkError(err)) throw err;
    }
  }
  if (lastRes) return lastRes;
  throw lastErr instanceof Error ? lastErr : new Error("Failed to fetch");
}

function chunkPlanFromMeta(meta: Record<string, unknown>): ShareGlbChunkPlan | null {
  const fileSizeBytes = Number(meta.fileSizeBytes);
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes < 1) return null;
  return {
    fileSizeBytes,
    chunkSize: DOWNLOAD_CHUNK_BYTES,
    totalChunks: Math.max(1, Math.ceil(fileSizeBytes / DOWNLOAD_CHUNK_BYTES)),
  };
}

function planFrom409(body: ShareGlbChunkPlan & { error?: string }): ShareGlbChunkPlan {
  const fileSizeBytes = body.fileSizeBytes;
  const chunkSize = body.chunkSize || DOWNLOAD_CHUNK_BYTES;
  return {
    fileSizeBytes,
    chunkSize,
    totalChunks:
      body.totalChunks > 0
        ? body.totalChunks
        : Math.max(1, Math.ceil(fileSizeBytes / chunkSize)),
  };
}

async function downloadChunked(
  token: string,
  plan: ShareGlbChunkPlan,
  onProgress?: (p: ShareGlbDownloadProgress) => void,
): Promise<Blob> {
  const enc = encodeURIComponent(token);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < plan.totalChunks; i++) {
    onProgress?.({ chunk: i + 1, total: plan.totalChunks });
    const res = await fetchWithRetry(`/api/models/${enc}/file/chunk/${i}`);
    if (!res.ok) throw new Error(`chunk ${i} ${res.status}`);
    parts.push(new Uint8Array(await res.arrayBuffer()));
  }
  const merged = new Uint8Array(plan.fileSizeBytes);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.byteLength;
  }
  return new Blob([merged], { type: "model/gltf-binary" });
}

export async function downloadShareGlb(
  token: string,
  meta?: Record<string, unknown> | null,
  onProgress?: (p: ShareGlbDownloadProgress) => void,
): Promise<Blob> {
  const enc = encodeURIComponent(token);
  const plan = meta ? chunkPlanFromMeta(meta) : null;

  if (plan && plan.fileSizeBytes > VPN_CHUNK_THRESHOLD_BYTES) {
    return downloadChunked(token, plan, onProgress);
  }

  try {
    const res = await fetchWithRetry(`/api/models/${enc}/file`);
    if (res.ok) return res.blob();
    if (res.status === 409) {
      const body = (await res.json()) as ShareGlbChunkPlan & { error?: string };
      if (body.fileSizeBytes > 0) {
        return downloadChunked(token, planFrom409(body), onProgress);
      }
    } else if (res.status !== 404) {
      throw new Error(`file ${res.status}`);
    }
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    if (plan) return downloadChunked(token, plan, onProgress);
  }

  const fallbackPlan = plan ?? (meta ? chunkPlanFromMeta(meta) : null);
  if (!fallbackPlan) throw new Error("file missing");
  return downloadChunked(token, fallbackPlan, onProgress);
}
