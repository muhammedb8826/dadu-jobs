import * as React from "react";
import Image from "next/image";
import { getStrapiURL } from "@/lib/strapi/client";
import { resolveImageUrl } from "@/lib/strapi/media";
import { cn } from "@/lib/utils";
import {
  extractRichTextPlainText,
  type StrapiRichTextContent,
  type StrapiRichTextNode,
} from "@/lib/strapi/rich-text";

type StrapiRichTextProps = {
  content?: StrapiRichTextContent | string | null;
  className?: string;
};

const applyTextMarks = (node: StrapiRichTextNode) => {
  if (!node.text) return null;
  let content: React.ReactNode = node.text;

  if (node.code) {
    content = <code>{content}</code>;
  }
  if (node.bold) {
    content = <strong>{content}</strong>;
  }
  if (node.italic) {
    content = <em>{content}</em>;
  }
  if (node.underline) {
    content = <u>{content}</u>;
  }
  if (node.strikethrough) {
    content = <s>{content}</s>;
  }

  return content;
};

const renderInlineNodes = (nodes?: StrapiRichTextNode[]) =>
  nodes?.map((node, index) => {
    if (node.type === "link" && node.url) {
      return (
        <a
          key={`link-${node.url}-${index}`}
          href={node.url}
          target={node.url.startsWith("http") ? "_blank" : undefined}
          rel={node.url.startsWith("http") ? "noopener noreferrer" : undefined}
        >
          {renderInlineNodes(node.children)}
        </a>
      );
    }

    if (node.text) {
      return <React.Fragment key={`text-${index}`}>{applyTextMarks(node)}</React.Fragment>;
    }

    if (node.children?.length) {
      return (
        <React.Fragment key={`inline-${index}`}>
          {renderInlineNodes(node.children)}
        </React.Fragment>
      );
    }

    return null;
  });

const hasBlockChildren = (nodes?: StrapiRichTextNode[]) =>
  Boolean(
    nodes?.some((node) => node.type && node.type !== "text" && node.type !== "link")
  );

const renderChildBlocks = (nodes?: StrapiRichTextNode[]) =>
  nodes?.map((node, index) => {
    if (node.type === "paragraph") {
      return <p key={`p-${index}`}>{renderInlineNodes(node.children)}</p>;
    }

    if (node.type) {
      return renderBlockNode(node, index);
    }

    if (node.text) {
      return <span key={`span-${index}`}>{applyTextMarks(node)}</span>;
    }

    if (node.children?.length) {
      return <span key={`span-${index}`}>{renderInlineNodes(node.children)}</span>;
    }

    return null;
  });

const renderInlineOrBlocks = (nodes?: StrapiRichTextNode[]) => {
  if (!nodes?.length) return null;
  if (!hasBlockChildren(nodes)) {
    return renderInlineNodes(nodes);
  }
  return renderChildBlocks(nodes);
};

const resolveImageSource = (node: StrapiRichTextNode) => {
  const image = node.image;
  if (!image?.url) return null;

  if (image.url.startsWith("http://") || image.url.startsWith("https://")) {
    return image.url;
  }

  const baseUrl = getStrapiURL();
  if (!baseUrl) return image.url;

  return (
    resolveImageUrl(image, baseUrl) ||
    `${baseUrl.replace(/\/$/, "")}${image.url.startsWith("/") ? image.url : `/${image.url}`}`
  );
};

const renderBlockNode = (node: StrapiRichTextNode, index: number) => {
  switch (node.type) {
    case "paragraph":
      return <p key={`p-${index}`}>{renderInlineNodes(node.children)}</p>;
    case "heading": {
      const level = node.level && node.level >= 1 && node.level <= 6 ? node.level : 2;
      const HeadingTag = `h${level}` as React.ElementType;
      return <HeadingTag key={`h-${index}`}>{renderInlineNodes(node.children)}</HeadingTag>;
    }
    case "list": {
      const isOrdered = node.format === "ordered";
      const ListTag = isOrdered ? "ol" : "ul";
      const listClasses = isOrdered ? "list-decimal" : "list-disc";
      return (
        <ListTag key={`list-${index}`} className={`${listClasses} pl-6`}>
          {node.children?.map((child, childIndex) =>
            renderBlockNode({ ...child, type: child.type ?? "list-item" }, childIndex)
          )}
        </ListTag>
      );
    }
    case "list-item":
      return <li key={`li-${index}`}>{renderInlineOrBlocks(node.children)}</li>;
    case "quote":
      return (
        <blockquote
          key={`quote-${index}`}
          className="border-l-4 border-border pl-4 italic text-muted-foreground"
        >
          {renderInlineOrBlocks(node.children)}
        </blockquote>
      );
    case "code": {
      const codeText = extractRichTextPlainText(node.children ?? []);
      return (
        <pre key={`code-${index}`}>
          <code>{codeText}</code>
        </pre>
      );
    }
    case "image": {
      const src = resolveImageSource(node);
      if (!src) return null;

      const width = node.image?.width ?? 960;
      const height = node.image?.height ?? 540;
      const alt = node.image?.alternativeText || node.image?.caption || "Rich text image";

      return (
        <figure key={`image-${index}`}>
          <Image src={src} alt={alt} width={width} height={height} className="rounded-md" />
          {node.image?.caption && <figcaption>{node.image.caption}</figcaption>}
        </figure>
      );
    }
    default:
      if (node.text) {
        return <React.Fragment key={`text-${index}`}>{applyTextMarks(node)}</React.Fragment>;
      }
      if (node.children?.length) {
        return <div key={`div-${index}`}>{renderInlineNodes(node.children)}</div>;
      }
      return null;
  }
};

export function StrapiRichText({ content, className }: StrapiRichTextProps) {
  if (!content) return null;

  if (typeof content === "string") {
    return (
      <div
        className={cn("prose prose-sm max-w-none", className)}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return (
    <div className={cn("prose prose-sm max-w-none", className)}>
      {content.map((node, index) => renderBlockNode(node, index))}
    </div>
  );
}
