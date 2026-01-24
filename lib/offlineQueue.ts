// lib/offlineQueue.ts
// Offline queue for prayers (audio  transcript) to be synced when online.
// Uses AsyncStorage  Expo FileSystem (already in the project). No new deps.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

export type OfflineQueuedPrayer = {
  id: string; // local id
  created_at: string; // ISO
  user_id: string;
  prayed_at: string; // ISO
  transcript_text: string | null;
  duration_seconds: number | null;
  is_bookmarked: boolean;
  local_audio_uri: string | null; // file://
  status: "queued" | "uploading" | "failed";
  attempts: number;
  last_error?: string;
  
};

export type OfflineQueuedAttachment = {
  id: string;
  created_at: string; // ISO
  user_id: string;
  prayer_id: string;
  local_image_uri: string; // file://
  status: "queued" | "uploading" | "failed";
  attempts: number;
  last_error?: string;
};

const ATTACHMENTS_STORAGE_KEY = "offline_prayer_attachments_queue_v1";
const ATTACHMENTS_LOCK_KEY = "offline_prayer_attachments_queue_lock_v1";
const STORAGE_KEY = "offline_prayer_queue_v1";
const LOCK_KEY = "offline_prayer_queue_lock_v1";

function uuidLike() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function readQueue(): Promise<OfflineQueuedPrayer[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineQueuedPrayer[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: OfflineQueuedPrayer[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

async function readAttachmentQueue(): Promise<OfflineQueuedAttachment[]> {
  const raw = await AsyncStorage.getItem(ATTACHMENTS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineQueuedAttachment[]) : [];
  } catch {
    return [];
  }
}

async function writeAttachmentQueue(items: OfflineQueuedAttachment[]) {
  await AsyncStorage.setItem(ATTACHMENTS_STORAGE_KEY, JSON.stringify(items));
}

async function tryAcquireAttachmentsLock(): Promise<boolean> {
  const now = Date.now();
  const raw = await AsyncStorage.getItem(ATTACHMENTS_LOCK_KEY);
  if (raw) {
    const ts = Number(raw);
    if (!Number.isNaN(ts) && now - ts < 60_000) return false;
  }
  await AsyncStorage.setItem(ATTACHMENTS_LOCK_KEY, String(now));
  return true;
}

async function releaseAttachmentsLock() {
  await AsyncStorage.removeItem(ATTACHMENTS_LOCK_KEY);
}


export async function enqueuePrayer(params: {
  userId: string;
  prayedAtISO: string;
  transcriptText: string | null;
  durationSeconds: number | null;
  isBookmarked: boolean;
  audioUri: string | null; // file://
  imageUri?: string;
  prayerId?: string;
}): Promise<OfflineQueuedPrayer> {
  const queue = await readQueue();

  let local_audio_uri: string | null = null;

  if (params.audioUri) {
    // Copy audio into app documents so it persists across restarts.
    const ext = params.audioUri.split(".").pop() || "m4a";
    const fileName = `offline_prayer_${Date.now()}.${ext}`;
    const dest = `${FileSystem.documentDirectory}${fileName}`;

    try {
      if (
        FileSystem.documentDirectory &&
        !params.audioUri.startsWith(FileSystem.documentDirectory)
      ) {
        await FileSystem.copyAsync({ from: params.audioUri, to: dest });
      }
    } catch {
      // ignore, fall back below
    }

    // Prefer the existing URI if already in documentDirectory; otherwise use dest
    local_audio_uri =
      FileSystem.documentDirectory &&
      params.audioUri.startsWith(FileSystem.documentDirectory)
        ? params.audioUri
        : dest;
  }

  const item: OfflineQueuedPrayer = {
    id: uuidLike(),
    created_at: new Date().toISOString(),
    user_id: params.userId,
    prayed_at: params.prayedAtISO,
    transcript_text: params.transcriptText,
    duration_seconds: params.durationSeconds,
    is_bookmarked: params.isBookmarked,
    local_audio_uri,
    status: "queued",
    attempts: 0,
  };

  queue.unshift(item);
  await writeQueue(queue);
  return item;
}

export async function enqueueAttachment(params: {
  userId: string;
  prayerId: string;
  imageUri: string; // file://
}): Promise<OfflineQueuedAttachment> {
  const queue = await readAttachmentQueue();

  const ext = params.imageUri.split("?")[0].split("#")[0].split(".").pop() || "jpg";
  const safeExt = ext.toLowerCase() === "png" ? "png" : "jpg";
  const fileName = `offline_attachment_${Date.now()}_${Math.random().toString(16).slice(2)}.${safeExt}`;
  const dest = `${FileSystem.documentDirectory}${fileName}`;

  let local_image_uri = params.imageUri;
  try {
    if (FileSystem.documentDirectory && !params.imageUri.startsWith(FileSystem.documentDirectory)) {
      await FileSystem.copyAsync({ from: params.imageUri, to: dest });
      local_image_uri = dest;
    }
  } catch {
    // keep original uri
  }

  const item: OfflineQueuedAttachment = {
    id: uuidLike(),
    created_at: new Date().toISOString(),
    user_id: params.userId,
    prayer_id: params.prayerId,
    local_image_uri,
    status: "queued",
    attempts: 0,
  };

  queue.unshift(item);
  await writeAttachmentQueue(queue);
  return item;
}

export async function getQueuedAttachmentsCount(userId?: string): Promise<number> {
  const queue = await readAttachmentQueue();
  return userId ? queue.filter((q) => q.user_id === userId).length : queue.length;
}


export async function getQueuedCount(userId?: string): Promise<number> {
  const queue = await readQueue();
  return userId ? queue.filter((q) => q.user_id === userId).length : queue.length;
}

export async function peekQueue(userId: string): Promise<OfflineQueuedPrayer[]> {
  const queue = await readQueue();
  return queue.filter((q) => q.user_id === userId);
}
export async function getQueueStatus(userId: string): Promise<{
  total: number;
  queued: number;
  uploading: number;
  failed: number;
  lastError?: string;
}> {
  const items = await peekQueue(userId);

  const queued = items.filter((i) => i.status === "queued").length;
  const uploading = items.filter((i) => i.status === "uploading").length;
  const failedItems = items.filter((i) => i.status === "failed");
  const failed = failedItems.length;

  const lastError =
    failedItems[0]?.last_error ||
    failedItems.find((x) => x.last_error)?.last_error;

  return {
    total: items.length,
    queued,
    uploading,
    failed,
    lastError,
  };
}
export async function clearQueue(userId?: string) {
  if (!userId) {
    await writeQueue([]);
    return;
  }
  const queue = await readQueue();
  await writeQueue(queue.filter((q) => q.user_id !== userId));
}

async function tryAcquireLock(): Promise<boolean> {
  const now = Date.now();
  const raw = await AsyncStorage.getItem(LOCK_KEY);
  if (raw) {
    const ts = Number(raw);
    // stale lock after 60s
    if (!Number.isNaN(ts) && now - ts < 60_000) return false;
  }
  await AsyncStorage.setItem(LOCK_KEY, String(now));
  return true;
}

async function releaseLock() {
  await AsyncStorage.removeItem(LOCK_KEY);
}

export async function syncQueuedPrayers(args: {
    userId: string;
    supabase: any; // SupabaseClient
    uploadAudio: (userId: string, uri: string) => Promise<string | null>;
    onProgress?: (info: { total: number; remaining: number; lastSyncedId?: string }) => void;
  }): Promise<{ synced: number; failed: number }> {
    const locked = await tryAcquireLock();
    if (!locked) return { synced: 0, failed: 0 };
  
    try {
      let queue = await readQueue();
      const userQueue = queue.filter((q) => q.user_id === args.userId);
      if (userQueue.length === 0) return { synced: 0, failed: 0 };
  
      let synced = 0;
      let failed = 0;
      const total = userQueue.length;
  
      for (const item of userQueue) {
        // Re-read queue each iteration to reduce race conditions
        queue = await readQueue();
        const idx = queue.findIndex((q) => q.id === item.id);
        if (idx === -1) continue;
  
        // mark uploading
        queue[idx] = {
          ...queue[idx],
          status: "uploading",
          attempts: (queue[idx].attempts || 0) + 1,
          last_error: undefined,
        };
        await writeQueue(queue);
  
        try {
          const storagePath = queue[idx].local_audio_uri
            ? await args.uploadAudio(args.userId, queue[idx].local_audio_uri)
            : null;

          // If we have a local audio file, upload must succeed
          if (queue[idx].local_audio_uri && !storagePath) {
            throw new Error("Audio upload failed");
          }
  
          const { data: insertedPrayer, error: insertError } = await args.supabase
            .from("prayers")
            .insert([
              {
                user_id: args.userId,
                prayed_at: queue[idx].prayed_at,
                transcript_text: queue[idx].transcript_text || null,
                duration_seconds: queue[idx].duration_seconds ?? null,
                audio_path: storagePath,
              },
            ])
            .select()
            .single();
  
          if (insertError) throw insertError;
  
          if (queue[idx].is_bookmarked && insertedPrayer?.id) {
            const { error: bmErr } = await args.supabase
              .from("bookmarked_prayers")
              .insert({ user_id: args.userId, prayer_id: insertedPrayer.id });
            if (bmErr) throw bmErr;
          }
  
          // remove local audio file (best-effort)
          if (queue[idx].local_audio_uri) {
            try {
              await FileSystem.deleteAsync(queue[idx].local_audio_uri, { idempotent: true });
            } catch {
              // ignore
            }
          }
  
          // remove item from queue
          queue = await readQueue();
          await writeQueue(queue.filter((q) => q.id !== item.id));
  
          synced++;
          args.onProgress?.({
            total,
            remaining: Math.max(0, total - synced - failed),
            lastSyncedId: item.id,
          });
        } catch (e: any) {
          failed++;
  
          queue = await readQueue();
          const j = queue.findIndex((q) => q.id === item.id);
          if (j !== -1) {
            queue[j] = {
              ...queue[j],
              status: "failed",
              last_error: e?.message ? String(e.message) : "Sync failed",
            };
            await writeQueue(queue);
          }
  
          args.onProgress?.({
            total,
            remaining: Math.max(0, total - synced - failed),
          });
        }
      }
  
      return { synced, failed };
    } finally {
      await releaseLock();
    }
  }
  
export async function syncQueuedAttachments(args: {
    userId: string;
    supabase: any;
    uploadImage: (userId: string, prayerId: string, uri: string) => Promise<string | null>;
    onProgress?: (info: { total: number; remaining: number; lastSyncedId?: string }) => void;
  }): Promise<{ synced: number; failed: number }> {
    const locked = await tryAcquireAttachmentsLock();
    if (!locked) return { synced: 0, failed: 0 };
  
    try {
      let queue = await readAttachmentQueue();
      const userQueue = queue.filter((q) => q.user_id === args.userId);
      if (userQueue.length === 0) return { synced: 0, failed: 0 };
  
      let synced = 0;
      let failed = 0;
      const total = userQueue.length;
  
      for (const item of userQueue) {
        queue = await readAttachmentQueue();
        const idx = queue.findIndex((q) => q.id === item.id);
        if (idx === -1) continue;
  
        queue[idx] = {
          ...queue[idx],
          status: "uploading",
          attempts: (queue[idx].attempts || 0) + 1,
          last_error: undefined,
        };
        await writeAttachmentQueue(queue);
  
        try {
          const storagePath = await args.uploadImage(
            args.userId,
            queue[idx].prayer_id,
            queue[idx].local_image_uri
          );
  
          if (!storagePath) throw new Error("Image upload failed");
  
          const { error: insertErr } = await args.supabase
            .from("prayer_attachments")
            .insert({
              user_id: args.userId,
              prayer_id: queue[idx].prayer_id,
              storage_path: storagePath,
              storage_bucket: "prayer-attachments",
            });
  
          if (insertErr) throw insertErr;
  
          try {
            await FileSystem.deleteAsync(queue[idx].local_image_uri, { idempotent: true });
          } catch {}
  
          queue = await readAttachmentQueue();
          await writeAttachmentQueue(queue.filter((q) => q.id !== item.id));
  
          synced++;
          args.onProgress?.({ total, remaining: Math.max(0, total - synced - failed), lastSyncedId: item.id });
        } catch (e: any) {
          failed++;
  
          queue = await readAttachmentQueue();
          const j = queue.findIndex((q) => q.id === item.id);
          if (j !== -1) {
            queue[j] = {
              ...queue[j],
              status: "failed",
              last_error: e?.message ? String(e.message) : "Sync failed",
            };
            await writeAttachmentQueue(queue);
          }
  
          args.onProgress?.({ total, remaining: Math.max(0, total - synced - failed) });
        }
      }
  
      return { synced, failed };
    } finally {
      await releaseAttachmentsLock();
    }
  }