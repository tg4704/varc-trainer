// Fisher-Yates. The `.sort(() => Math.random() - 0.5)` idiom this replaces is
// not a uniform shuffle - the comparator is inconsistent, so V8's TimSort
// leaves elements biased toward their original index. With a slice(0, N) on
// top of it, that bias decided which questions a user actually saw.
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = { shuffle };
