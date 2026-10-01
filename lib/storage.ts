import { getStore } from "@netlify/blobs";
import type { InternalGameState } from "./types.ts";

export interface StorageResult<T> {
  data: T | null;
  etag: string | null;
  metadata?: Record<string, unknown>;
}

// In-memory fallback for local development or environments without Netlify Blobs credentials
const localMemoryStore = new Map<string, { data: InternalGameState; etag: string; updatedAt: number }>();

function isNetlifyBlobsAvailable(): boolean {
  return typeof process !== "undefined" && Boolean(
    process.env.NETLIFY ||
    process.env.NETLIFY_BLOBS_CONTEXT ||
    process.env.DEPLOY_ID
  );
}

function getBlobsStore() {
  return getStore({
    name: "hallucination-games",
    consistency: "strong"
  });
}

export async function getGameSession(roomCode: string): Promise<StorageResult<InternalGameState>> {
  const code = roomCode.toUpperCase().trim();

  if (isNetlifyBlobsAvailable()) {
    try {
      const store = getBlobsStore();
      const res = await store.getWithMetadata(code, { type: "json" });
      if (!res || !res.data) {
        return { data: null, etag: null };
      }
      return {
        data: res.data as InternalGameState,
        etag: res.etag || String(res.data.version),
        metadata: res.metadata
      };
    } catch (err) {
      console.warn("Netlify Blobs getWithMetadata error, falling back to local store:", err);
    }
  }

  const item = localMemoryStore.get(code);
  if (!item) {
    return { data: null, etag: null };
  }
  return {
    data: JSON.parse(JSON.stringify(item.data)),
    etag: item.etag,
    metadata: { version: item.data.version }
  };
}

export async function setGameSession(
  roomCode: string,
  state: InternalGameState,
  expectedEtag?: string | null
): Promise<{ success: boolean; etag: string }> {
  const code = roomCode.toUpperCase().trim();
  const nextVersion = (state.version || 0) + 1;
  const updatedState: InternalGameState = {
    ...state,
    version: nextVersion,
    updatedAt: Date.now()
  };
  const newEtag = `v-${nextVersion}-${Date.now()}`;

  if (isNetlifyBlobsAvailable()) {
    try {
      const store = getBlobsStore();
      const setOptions: {
        metadata: Record<string, unknown>;
        onlyIf?: { etag: string };
      } = {
        metadata: { version: nextVersion, updatedAt: updatedState.updatedAt }
      };

      if (expectedEtag) {
        setOptions.onlyIf = { etag: expectedEtag };
      }

      await store.setJSON(code, updatedState, setOptions);
      return { success: true, etag: newEtag };
    } catch (err: unknown) {
      // Netlify Blobs throws if conditional write fails (HTTP 412 / ConditionNotMet)
      console.warn("Netlify Blobs setJSON conditional write conflict or error:", err);
      return { success: false, etag: "" };
    }
  }

  // Local memory store conditional write check
  const existing = localMemoryStore.get(code);
  if (expectedEtag && existing && existing.etag !== expectedEtag) {
    // Conflict detected: conditional write rejected
    return { success: false, etag: existing.etag };
  }

  localMemoryStore.set(code, {
    data: JSON.parse(JSON.stringify(updatedState)),
    etag: newEtag,
    updatedAt: updatedState.updatedAt
  });

  return { success: true, etag: newEtag };
}
