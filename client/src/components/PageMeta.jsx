import { useEffect } from "react";

// Per-route <title>/<meta description> for public pages, without a helmet
// library - react-helmet-async's client-side commit path never fired in this
// app (traced to its Context.Consumer + HelmetDispatcher wiring; no data-rh
// tags were ever written to <head>), so a plain useEffect is simpler and has
// no such risk. Restores the previous title/description on unmount so
// navigating away cleanly reverts rather than leaking one page's meta into
// the next. OG/Twitter tags stay static in index.html - link-preview
// crawlers generally don't execute JS, so tags set here would never be seen.
export default function PageMeta({ title, description }) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;

    let metaEl = document.querySelector('meta[name="description"]');
    let created = false;
    const prevDescription = metaEl?.getAttribute("content") ?? null;
    if (description) {
      if (!metaEl) {
        metaEl = document.createElement("meta");
        metaEl.setAttribute("name", "description");
        document.head.appendChild(metaEl);
        created = true;
      }
      metaEl.setAttribute("content", description);
    }

    return () => {
      document.title = prevTitle;
      if (metaEl) {
        if (created) metaEl.remove();
        else if (prevDescription != null) metaEl.setAttribute("content", prevDescription);
      }
    };
  }, [title, description]);

  return null;
}
