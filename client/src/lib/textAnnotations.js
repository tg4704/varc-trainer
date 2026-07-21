// Offset-based text annotations (highlight / underline / note) over a plain
// rendered passage. The passage is always re-rendered from the canonical
// `question.paragraph` string; annotations are {type, start, end, note?}
// character-offset ranges into that string, so nothing about the DOM itself
// needs to be mutable or contentEditable.

// Walks the text nodes under `root` to convert a Selection Range boundary
// (node + offset) into a plain character offset into root's full text.
export function domOffsetToTextOffset(root, node, nodeOffset) {
  let charCount = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current;
  while ((current = walker.nextNode())) {
    if (current === node) return charCount + nodeOffset;
    charCount += current.textContent.length;
  }
  return charCount;
}

// Splits `text` into segments, each tagged with EVERY annotation covering it
// (`anns`, ordered note > highlight > underline). A segment covered by both a
// highlight and an underline keeps both — the styles compose (see
// mergedAnnotationStyle) rather than one silently winning. `ann` is the
// highest-priority one, kept for click-target / tooltip purposes.
const PRIORITY = { note: 3, highlight: 2, underline: 1 };

export function buildTextSegments(text, annotations) {
  if (!annotations || annotations.length === 0) return [{ text, anns: [], ann: null }];

  const bounds = new Set([0, text.length]);
  annotations.forEach((a) => {
    bounds.add(Math.max(0, Math.min(text.length, a.start)));
    bounds.add(Math.max(0, Math.min(text.length, a.end)));
  });
  const points = [...bounds].sort((a, b) => a - b);

  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (start >= end) continue;
    const covering = annotations
      .filter((a) => a.start <= start && a.end >= end)
      .sort((a, b) => (PRIORITY[b.type] || 0) - (PRIORITY[a.type] || 0));
    segments.push({ text: text.slice(start, end), anns: covering, ann: covering[0] || null });
  }
  return segments;
}

// Composes the styles of every annotation covering one segment. Later (lower
// priority) types only fill in properties the higher-priority one didn't set,
// so a highlight+underline overlap shows the teal wash AND the underline,
// while two conflicting borders don't fight.
export function mergedAnnotationStyle(anns) {
  if (!anns || anns.length === 0) return null;
  const style = {};
  anns.forEach((a) => {
    const s = ANNOTATION_STYLES[a.type];
    if (!s) return;
    Object.entries(s).forEach(([k, v]) => {
      if (style[k] === undefined) style[k] = v;
    });
  });
  return style;
}

export const ANNOTATION_STYLES = {
  highlight: { background: "rgba(93,202,165,0.18)", borderRadius: 3 },
  underline: { borderBottom: "2px solid var(--periwinkle)" },
  note: { background: "rgba(240,168,104,0.16)", borderBottom: "2px dotted var(--amber)", cursor: "help" },
};
