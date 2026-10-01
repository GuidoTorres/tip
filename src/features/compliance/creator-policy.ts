export const CREATOR_POLICY_VERSION = "2026-09-07";

export const CONTENT_CATEGORIES = [
  "livestreaming",
  "short_video",
  "music",
  "gaming",
  "education",
  "other",
] as const;

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

export const CONTENT_CATEGORY_LABELS: Record<ContentCategory, { es: string; en: string }> = {
  livestreaming: { es: "Transmisiones en vivo", en: "Livestreaming" },
  short_video: { es: "Videos cortos", en: "Short-form video" },
  music: { es: "Música", en: "Music" },
  gaming: { es: "Gaming", en: "Gaming" },
  education: { es: "Educación", en: "Education" },
  other: { es: "Otro contenido permitido", en: "Other permitted content" },
};
