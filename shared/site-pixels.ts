export type PublicPixelConfig = {
  facebookPixelId: string;
  facebookPixelIds?: string[];
  tiktokPixelId: string;
  tiktokPixelIds?: string[];
  tiktokCode: string;
};

/** Stored strictly server-side; never exposed through `/api/tracking/bootstrap.js`. */
export type PixelServerSecrets = {
  facebookCapiTokens: Record<string, string>;
  facebookDefaultCapiToken?: string;
  facebookTestEventCode?: string;
};

export type PublicPixelSecretsStatus = {
  hasDefaultCapiToken: boolean;
  defaultCapiTokenPreview: string;
  envDefaultConfigured: boolean;
  capiTokenPreviews: Record<string, string>;
  testEventCode: string;
};

/** Identifiants publics, et non jetons d'API ou secrets. */
export const sitePixelConfig: PublicPixelConfig = {
  facebookPixelId: "916933364742371",
  facebookPixelIds: ["916933364742371", "1704139624720433"],
  tiktokPixelId: "CUD92NJC77U74NKABJI0",
  tiktokCode: "",
};

/**
 * Normalizes a list of pixel IDs (supports single primary ID, array of IDs, or comma/whitespace-separated values),
 * preserving insertion order and removing duplicates/blanks.
 */
export function normalizePixelIdList(ids?: readonly string[] | null, primaryId?: string | null): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const pushRaw = (raw?: string | null) => {
    if (typeof raw !== "string") return;
    for (const part of raw.split(/[\s,;]+/)) {
      const clean = part.trim();
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        result.push(clean);
      }
    }
  };
  if (Array.isArray(ids)) {
    for (const item of ids) pushRaw(item);
  } else if (typeof primaryId === "string" && primaryId.trim()) {
    pushRaw(primaryId);
  }
  return result;
}

export function getFacebookPixelIds(config?: Partial<PublicPixelConfig> | null): string[] {
  if (!config) return [];
  return normalizePixelIdList(config.facebookPixelIds, config.facebookPixelId);
}

export function getTikTokPixelIds(config?: Partial<PublicPixelConfig> | null): string[] {
  if (!config) return [];
  return normalizePixelIdList(config.tiktokPixelIds, config.tiktokPixelId);
}

export function normalizePublicPixelConfig(
  raw?: Partial<PublicPixelConfig> | null,
  fallback: PublicPixelConfig = sitePixelConfig,
): PublicPixelConfig {
  const hasFbField =
    raw !== undefined &&
    raw !== null &&
    (Array.isArray(raw.facebookPixelIds) || typeof raw.facebookPixelId === "string");
  const hasTtField =
    raw !== undefined &&
    raw !== null &&
    (Array.isArray(raw.tiktokPixelIds) || typeof raw.tiktokPixelId === "string");

  let fbIds = hasFbField
    ? normalizePixelIdList(raw?.facebookPixelIds, raw?.facebookPixelId)
    : normalizePixelIdList(fallback.facebookPixelIds, fallback.facebookPixelId);
  // Upgrade legacy single-pixel config from older cloud state to include newly added default FB pixels
  if (
    raw &&
    !Array.isArray(raw.facebookPixelIds) &&
    typeof raw.facebookPixelId === "string" &&
    raw.facebookPixelId.trim() === fallback.facebookPixelId &&
    Array.isArray(fallback.facebookPixelIds) &&
    fallback.facebookPixelIds.length > 1
  ) {
    fbIds = normalizePixelIdList([...fbIds, ...fallback.facebookPixelIds]);
  }

  const ttIds = hasTtField
    ? normalizePixelIdList(raw?.tiktokPixelIds, raw?.tiktokPixelId)
    : normalizePixelIdList(fallback.tiktokPixelIds, fallback.tiktokPixelId);
  const tiktokCode =
    raw && typeof raw.tiktokCode === "string" ? raw.tiktokCode.trim() : (fallback.tiktokCode || "").trim();

  return {
    facebookPixelId: fbIds[0] || "",
    facebookPixelIds: fbIds,
    tiktokPixelId: ttIds[0] || "",
    tiktokPixelIds: ttIds,
    tiktokCode,
  };
}
