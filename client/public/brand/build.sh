#!/bin/bash
# Regenerates the PNG brand assets in this folder from the SVG/HTML sources.
# Needs Google Chrome (headless screenshot) and a network connection for the
# Newsreader webfont — the wordmark uses the same display face as the app.
set -e
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

cat > /tmp/graspr-mark.html <<'HTML'
<style>html,body{margin:0}body{display:flex;align-items:center;justify-content:center;height:512px}
svg{width:512px;height:512px}</style>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>
<linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform="rotate(140)">
<stop offset="0%" stop-color="#5DCAA5"/><stop offset="100%" stop-color="#8B9DFF"/></linearGradient></defs>
<rect width="64" height="64" rx="19" fill="url(#g)"/>
<rect x="21.5" y="21.5" width="21" height="21" rx="6" fill="#0B0D13"/></svg>
HTML

wordmark() { # wordmark <textcolor> <pagebg> <out>
cat > /tmp/graspr-wm.html <<HTML
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:wght@500&display=swap">
<style>html,body{margin:0}
body{display:flex;align-items:center;justify-content:center;gap:34px;height:320px;background:$2}
.mark{width:132px;height:132px;border-radius:40px;display:flex;align-items:center;justify-content:center;
background:linear-gradient(140deg,#5DCAA5,#8B9DFF)}
.mark i{width:44px;height:44px;border-radius:13px;background:#0B0D13;display:block}
.wm{font:500 116px Newsreader,serif;letter-spacing:-.02em;color:$1;line-height:1}
.dot{color:#5DCAA5}</style>
<div class="mark"><i></i></div><div class="wm">graspr<span class="dot">.</span>in</div>
HTML
"$CHROME" --headless --disable-gpu --hide-scrollbars --default-background-color=00000000 \
  --screenshot="$3" --window-size=1000,320 --virtual-time-budget=5000 \
  "file:///tmp/graspr-wm.html" 2>/dev/null
}

"$CHROME" --headless --disable-gpu --hide-scrollbars --default-background-color=00000000 \
  --screenshot="logo-mark-512.png" --window-size=512,512 --virtual-time-budget=2000 \
  "file:///tmp/graspr-mark.html" 2>/dev/null

wordmark "#F4F6F8" "transparent"  "logo-wordmark-light.png"
wordmark "#0B0D13" "transparent"  "logo-wordmark-dark.png"
wordmark "#F4F6F8" "#0B0D13"      "logo-wordmark-on-dark.png"
echo "done"
