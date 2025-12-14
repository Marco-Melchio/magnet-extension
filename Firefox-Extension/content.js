function findMagnet() {
  const a = document.querySelector('a[href^="magnet:"]');
  if (a) return a.href;

  // Fallback: data-attribute (wenn vorhanden)
  const el = document.querySelector('[data-clipboard-text],[data-magnet],[data-url],[data-href]');
  if (el) {
    const keys = ["data-clipboard-text", "data-magnet", "data-url", "data-href"];
    for (const k of keys) {
      const v = el.getAttribute(k);
      if (v && v.toLowerCase().startsWith("magnet:?")) return v;
    }
  }
  return null;
}

function guessTitleYear() {
  // Quelle: document.title + ggf. H1
  const h1 = document.querySelector("h1");
  const raw = (h1?.textContent || document.title || "").trim();

  // Jahr suchen (1900-2099)
  const yearMatch = raw.match(/\b(19\d{2}|20\d{2})\b/);
  const year = yearMatch ? yearMatch[1] : "";

  // Titel bereinigen: Klammern/Jahr am Ende weg
  let title = raw;
  if (year) title = title.replace(new RegExp(`\\s*[\\(\\[]?${year}[\\)\\]]?\\s*`, "g"), " ").trim();
  title = title.replace(/\s+/g, " ").trim();

  return { raw, title, year };
}

function guessTypeFromText(text) {
  const t = (text || "").toLowerCase();
  // sehr grobe Heuristik
  const isSeries =
    /\bs\d{1,2}e\d{1,2}\b/.test(t) ||
    /\b\d{1,2}x\d{1,2}\b/.test(t) ||
    /\bseason\s*\d+\b/.test(t) ||
    /\bstaffel\s*\d+\b/.test(t);

  return isSeries ? "series" : "movie";
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "EXTRACT") {
    const magnet = findMagnet();
    const meta = guessTitleYear();
    const typeGuess = guessTypeFromText(meta.raw);
    return Promise.resolve({ magnet, ...meta, typeGuess, pageUrl: location.href });
  }
});
