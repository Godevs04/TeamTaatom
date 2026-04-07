import { sanitizeHashtag, sanitizeMention, sanitizeTextContent } from "./caption-sanitize";

export type CaptionPart = {
  text: string;
  type: "text" | "hashtag" | "mention";
  value?: string;
};

const TOKEN_RE = /(@[\w.]+|#[\w]+)/gu;

/**
 * Split caption into plain text, hashtags, and @mentions (same rules as mobile HashtagMentionText).
 */
export function parseCaptionParts(raw: string): CaptionPart[] {
  const sanitizedText = sanitizeTextContent(raw);
  if (!sanitizedText) return [];

  const parts: CaptionPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const re = new RegExp(TOKEN_RE.source, TOKEN_RE.flags);
  while ((match = re.exec(sanitizedText)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        text: sanitizedText.slice(lastIndex, match.index),
        type: "text",
      });
    }
    const matchedText = match[0];
    if (matchedText.startsWith("#")) {
      const tag = sanitizeHashtag(matchedText);
      if (tag.length > 1) {
        parts.push({
          text: tag,
          type: "hashtag",
          value: tag.replace(/^#/, ""),
        });
      }
    } else if (matchedText.startsWith("@")) {
      const user = sanitizeMention(matchedText);
      if (user) {
        parts.push({
          text: `@${user}`,
          type: "mention",
          value: user,
        });
      }
    }
    lastIndex = match.index + matchedText.length;
  }

  if (lastIndex < sanitizedText.length) {
    parts.push({
      text: sanitizedText.slice(lastIndex),
      type: "text",
    });
  }

  return parts;
}
