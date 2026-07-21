// Models occasionally wrap JSON in ```json fences despite instructions not to.
// Strip fences and grab the first {...} or [...] block before parsing.
function extractJSON(text) {
  let t = String(text).trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) t = fenced[1].trim();
  const firstObj = t.indexOf("{");
  const firstArr = t.indexOf("[");
  let start = -1;
  let closer = "}";
  if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
    start = firstArr;
    closer = "]";
  } else if (firstObj !== -1) {
    start = firstObj;
    closer = "}";
  }
  if (start !== -1) {
    const end = t.lastIndexOf(closer);
    if (end > start) t = t.slice(start, end + 1);
  }
  return JSON.parse(t);
}

module.exports = { extractJSON };
