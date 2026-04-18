const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h3",
  "h4",
  "a",
] as const;

const ALLOWED_TAG_SET = new Set<string>(ALLOWED_TAGS);
const ALLOWED_TAG_PATTERN = ALLOWED_TAGS.join("|");
const DISALLOWED_TAG_RE = new RegExp(
  `<\\/?(?!(${ALLOWED_TAG_PATTERN})\\b)[a-z][^>]*>`,
  "gi"
);

function stripDangerousBlocks(input: string) {
  return input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<(script|style|iframe|object|embed|form|input|button|textarea|select|option)[^>]*>[\s\S]*?<\/\1>/gi,
      ""
    )
    .replace(
      /<(script|style|iframe|object|embed|form|input|button|textarea|select|option)\b[^>]*\/?>/gi,
      ""
    );
}

function sanitizeAnchors(input: string) {
  return input.replace(/<a\b([^>]*)>/gi, (_match, attrs: string) => {
    const hrefMatch = attrs.match(
      /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
    );

    const rawHref = hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3] ?? "";
    const href = rawHref.trim();

    if (!href || !/^(https?:|mailto:|tel:|\/)/i.test(href)) {
      return "<a>";
    }

    return `<a href="${escapeHtml(
      href
    )}" target="_blank" rel="noopener noreferrer">`;
  });
}

export function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function hasHtmlTags(input: string) {
  return /<\/?[a-z][\s\S]*>/i.test(input);
}

export function plainTextToRichText(input: string) {
  const text = input.trim();
  if (!text) return "";

  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`
    )
    .join("");
}

export function sanitizeRichText(input: string) {
  const value = input.trim();
  if (!value) return "";

  let sanitized = stripDangerousBlocks(value)
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\sstyle\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/<(\/?)(b)\b/gi, "<$1strong")
    .replace(/<(\/?)(i)\b/gi, "<$1em")
    .replace(/<br\s*\/?>/gi, "<br />")
    .replace(DISALLOWED_TAG_RE, "");

  sanitized = sanitizeAnchors(sanitized)
    .replace(/<([a-z0-9]+)\b[^>]*>/gi, (_match, tagName: string) => {
      const tag = tagName.toLowerCase();
      if (!ALLOWED_TAG_SET.has(tag)) {
        return "";
      }

      if (tag === "a") {
        return _match;
      }

      if (tag === "br") {
        return "<br />";
      }

      return `<${tag}>`;
    })
    .replace(/<\/([a-z0-9]+)\b[^>]*>/gi, (_match, tagName: string) => {
      const tag = tagName.toLowerCase();
      if (!ALLOWED_TAG_SET.has(tag) || tag === "br") {
        return "";
      }

      return `</${tag}>`;
    })
    .replace(/<p>(?:\s|&nbsp;|<br \/?>)*<\/p>/gi, "")
    .trim();

  return sanitized;
}

export function prepareRichText(input: string | null | undefined) {
  const value = (input ?? "").trim();
  if (!value) return "";

  const html = hasHtmlTags(value) ? value : plainTextToRichText(value);
  return sanitizeRichText(html);
}
