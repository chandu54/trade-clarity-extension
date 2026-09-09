import React from "react";

/**
 * Reusable component to highlight matching search terms within text.
 * Renders matching substrings wrapped in high-contrast <mark> tags.
 *
 * @param {Object} props
 * @param {string|number} props.text - The text to display and highlight within
 * @param {string} props.highlight - The search query/term to highlight
 * @param {string} [props.className] - Optional container class name
 * @param {string} [props.highlightClassName] - Optional highlight mark class name
 */
export default function HighlightText({
  text,
  highlight = "",
  className = "",
  highlightClassName = "ai-search-highlight",
}) {
  if (text === null || text === undefined) return null;
  const strText = String(text);
  if (!strText) return null;

  if (!highlight || !highlight.trim()) {
    return className ? <span className={className}>{strText}</span> : <>{strText}</>;
  }

  const trimmed = highlight.trim();
  const words = trimmed
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (words.length === 0) {
    return className ? <span className={className}>{strText}</span> : <>{strText}</>;
  }

  // Sort longest first to avoid partial prefix interference
  words.sort((a, b) => b.length - a.length);
  const regex = new RegExp(`(${words.join("|")})`, "gi");
  const testRegex = new RegExp(`^(${words.join("|")})$`, "i");
  const parts = strText.split(regex);

  const content = parts.map((part, i) => {
    if (testRegex.test(part)) {
      return (
        <mark key={i} className={highlightClassName}>
          {part}
        </mark>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });

  return className ? <span className={className}>{content}</span> : <>{content}</>;
}
