/**
 * Chart-screenshot attachment rules (docs/decisions.md § Phase 4b — none of
 * these numbers are in the spec, chosen and confirmed with the user).
 *
 * `attachments.trade_id` is NOT NULL, so a DB row can't exist before a trade
 * does. Uploads still happen immediately on drop (see attachments-client.ts)
 * so they survive a draft restore the same way typed fields do; they land in
 * a single well-known temp folder per user and get moved to their final
 * {user_id}/{tradeId}/ path only once the trade is actually saved.
 */
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB
export const MAX_ATTACHMENTS_PER_TRADE = 6;
export const ALLOWED_ATTACHMENT_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const CHART_SHOTS_BUCKET = "chart-shots";

/** {user_id}/drafts/ — the one temp holding area, since a user has exactly one draft. */
export function draftAttachmentFolder(userId: string): string {
  return `${userId}/drafts`;
}

export function draftAttachmentPath(userId: string, filename: string): string {
  return `${draftAttachmentFolder(userId)}/${filename}`;
}

export function tradeAttachmentPath(userId: string, tradeId: string, filename: string): string {
  return `${userId}/${tradeId}/${filename}`;
}

/** The filename segment after the last '/', used to preserve it across a move. */
export function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

export type AttachmentRejectionReason = "type" | "size" | "count";

export interface AttachmentValidationResult {
  accepted: File[];
  rejected: { file: File; reason: AttachmentRejectionReason }[];
}

/**
 * Filters a file list against type/size/count rules. `existingCount` is how
 * many attachments (uploaded + already-saved) the trade already has, so the
 * cap applies across multiple drops, not just within one.
 */
export function validateAttachments(
  files: readonly File[],
  existingCount: number,
): AttachmentValidationResult {
  const accepted: File[] = [];
  const rejected: AttachmentValidationResult["rejected"] = [];
  let count = existingCount;

  for (const file of files) {
    if (!(ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
      rejected.push({ file, reason: "type" });
      continue;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      rejected.push({ file, reason: "size" });
      continue;
    }
    if (count >= MAX_ATTACHMENTS_PER_TRADE) {
      rejected.push({ file, reason: "count" });
      continue;
    }
    accepted.push(file);
    count += 1;
  }

  return { accepted, rejected };
}

/** A filename collision-proof enough for one user's temp folder. */
export function uniqueAttachmentFilename(originalName: string): string {
  const dot = originalName.lastIndexOf(".");
  const ext = dot === -1 ? "" : originalName.slice(dot); // includes the dot
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `${stamp}${ext}`;
}
