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
  const text = content.map(extractNodeText).join(" ");
  return text.replace(/\s+/g, " ").trim();
};
