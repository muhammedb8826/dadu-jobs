type StrapiFormat = {
  url: string;
};

export type StrapiImage = {
  url: string;
  formats?: Record<string, StrapiFormat>;
};

const formatPreference = ["large", "medium", "small", "thumbnail"];

function asStrapiImage(image: unknown): StrapiImage | null {
  if (!image || typeof image !== "object") return null;
  const url = (image as { url?: unknown }).url;
  if (typeof url !== "string" || !url) return null;
  return image as StrapiImage;
}

export function resolveImageUrl(image: unknown, baseUrl: string) {
  const normalized = asStrapiImage(image);
  if (!normalized) return undefined;

  const candidate =
    normalized.formats &&
    formatPreference
      .map((key) => normalized.formats?.[key])
      .find((format): format is StrapiFormat => Boolean(format));

  const relativeUrl = candidate?.url ?? normalized.url;
  if (!relativeUrl) return undefined;

  // ensure no double slashes
  return `${baseUrl.replace(/\/$/, "")}${relativeUrl}`;
}

