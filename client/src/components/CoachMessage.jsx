// Renders a coach reply as readable prose instead of one raw block.
//
// The model returns short paragraphs and the occasional list. Previously the
// chat printed message.text directly, so a reply with three points collapsed
// into an unbroken wall inside a narrow bubble. This does the minimum needed
// to make it scannable: paragraphs, bullets, numbered items, **bold**, `code`.
//
// Built out of React elements on purpose. There is no dangerouslySetInnerHTML
// anywhere in client/src and model output is the last place to introduce one.

// Splits a line into text / bold / code spans. Model output is the input here,
// so anything unmatched falls through as plain text rather than throwing.
function renderInline(line, keyPrefix) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m;
  let n = 0;

  while ((m = re.exec(line)) !== null) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      parts.push(
        <strong key={`${keyPrefix}-b${n++}`} style={{ fontWeight: 600, color: "var(--text)" }}>
          {tok.slice(2, -2)}
        </strong>
      );
    } else {
      parts.push(
        <code
          key={`${keyPrefix}-c${n++}`}
          className="mono"
          style={{ fontSize: "0.9em", background: "rgba(255,255,255,0.07)", padding: "1px 4px", borderRadius: 4 }}
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    last = m.index + tok.length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts.length ? parts : line;
}

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*(\d+)[.)]\s+/;

export default function CoachMessage({ text }) {
  // Group consecutive list lines together so they render as one list.
  const blocks = [];
  for (const raw of String(text ?? "").split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;

    const numbered = NUMBERED.exec(line);
    const kind = BULLET.test(line) ? "ul" : numbered ? "ol" : "p";
    const content = kind === "ul" ? line.replace(BULLET, "") : numbered ? line.replace(NUMBERED, "") : line;

    const prev = blocks[blocks.length - 1];
    if (kind !== "p" && prev && prev.kind === kind) prev.items.push(content);
    else blocks.push({ kind, items: [content] });
  }

  if (!blocks.length) return null;

  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        if (b.kind === "p") return <p key={i}>{renderInline(b.items[0], `${i}`)}</p>;
        const List = b.kind === "ul" ? "ul" : "ol";
        return (
          <List
            key={i}
            className="space-y-1"
            style={{
              listStyleType: b.kind === "ul" ? "disc" : "decimal",
              paddingLeft: "1.15em",
              // Keeps markers in the muted tone while the text stays full contrast.
              color: "var(--text-2)",
            }}
          >
            {b.items.map((it, j) => (
              <li key={j}>
                <span style={{ color: "var(--text)" }}>{renderInline(it, `${i}-${j}`)}</span>
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
