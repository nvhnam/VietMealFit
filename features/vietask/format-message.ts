export type MessageSegment = { text: string; bold: boolean };

/**
 * Splits assistant text into plain and bold runs.
 *
 * The model emits Markdown emphasis around dish names even though nothing
 * instructs it to, and the chat bubble renders with `whitespace-pre-wrap` —
 * so the asterisks were showing up literally ("**Stir-fried water spinach**").
 *
 * Deliberately only `**bold**`, not a Markdown parser: that is the one
 * construct actually observed in replies, and a full parser would be a new
 * dependency plus a much larger surface for mangling ordinary text. A single
 * unmatched `**` is left alone rather than being treated as an opening marker,
 * so nothing is silently swallowed.
 */
export function parseMessageSegments(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const pattern = /\*\*([\s\S]+?)\*\*/g;
  let lastIndex = 0;

  for (const match of content.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ text: content.slice(lastIndex, start), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({ text: content.slice(lastIndex), bold: false });
  }
  return segments;
}
