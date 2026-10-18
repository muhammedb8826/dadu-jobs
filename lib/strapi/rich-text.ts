export type StrapiRichTextImage = {
  url: string;
  alternativeText?: string | null;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
  formats?: Record<string, { url: string }>;
};

export type StrapiRichTextNode = {
  type?: string;
  text?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  url?: string;
  level?: number;
  format?: "ordered" | "unordered";
  image?: StrapiRichTextImage;
  children?: StrapiRichTextNode[];
};

export type StrapiRichTextContent = StrapiRichTextNode[];

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const extractNodeText = (node?: StrapiRichTextNode): string => {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  if (node.type === "image") return node.image?.alternativeText ?? "";
  if (node.children?.length) {
    return node.children.map(extractNodeText).join(" ");
  }
  return "";
};

export const extractRichTextPlainText = (
  content?: StrapiRichTextContent | string | null
) => {
  if (!content) return "";
  if (typeof content === "string") {
    return stripHtml(content);
  }
  const text = content.map(extractNodeText).join("\n\n");
  return text.replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
};

/**
 * Convert plain text / HTML string (or existing blocks) into Strapi Blocks JSON.
 * Job.description is type "blocks" — a plain string is ignored/null by Strapi.
 */
export function toStrapiBlocks(
  content?: StrapiRichTextContent | string | null
): StrapiRichTextContent {
  if (Array.isArray(content)) {
    return content;
  }
  if (typeof content !== "string") {
    return [];
  }

  const normalized = content
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  const paragraphs = normalized
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return [];
  }

  return paragraphs.map((text) => ({
    type: "paragraph",
    children: [{ type: "text", text }],
  }));
}
