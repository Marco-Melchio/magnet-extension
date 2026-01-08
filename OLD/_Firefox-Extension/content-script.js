(function () {
  const extensionApi = typeof browser !== 'undefined' ? browser : chrome;

  const YEAR_REGEX = /\b(19|20)\d{2}\b/;
  const MAGNET_REGEX = /magnet:\?[^"'\s<>]+/i;

  function textFromSelector(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent) {
        return el.textContent.trim();
      }
    }
    return '';
  }

  function findMagnetLink() {
    const anchor = document.querySelector('a[href^="magnet:?"], a[href*="magnet:?"], a[data-magnet]');
    if (anchor && anchor.href) {
      return anchor.href;
    }

    const textMatch = document.body ? document.body.innerText.match(MAGNET_REGEX) : null;
    if (textMatch) {
      return textMatch[0];
    }

    return '';
  }

  function findYear() {
    const metaCandidates = [
      'meta[itemprop="datePublished"]',
      'meta[itemprop="dateCreated"]',
      'meta[name="date"]',
      'meta[property="og:release_date"]',
      'meta[property="video:release_date"]'
    ];

    for (const selector of metaCandidates) {
      const meta = document.querySelector(selector);
      const content = meta && meta.getAttribute('content');
      if (content) {
        const match = content.match(YEAR_REGEX);
        if (match) {
          return match[0];
        }
      }
    }

    const titleMatch = (document.title || '').match(YEAR_REGEX);
    if (titleMatch) {
      return titleMatch[0];
    }

    const prominentText = textFromSelector(['h1', 'h2', '.title', '[data-title]']);
    const prominentMatch = prominentText.match(YEAR_REGEX);
    if (prominentMatch) {
      return prominentMatch[0];
    }

    if (document.body) {
      const snippet = document.body.innerText.slice(0, 8000);
      const match = snippet.match(YEAR_REGEX);
      if (match) {
        return match[0];
      }
    }

    return '';
  }

  function deriveTitle(year) {
    const titleCandidates = [
      textFromSelector(['h1', 'h2', 'header h1']),
      (document.title || '')
    ].filter(Boolean);

    for (const candidate of titleCandidates) {
      const clean = candidate.replace(YEAR_REGEX, '').replace(/[()\[\]]/g, '').trim();
      if (clean) return clean;
    }

    return '';
  }

  extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'collectData') {
      const magnetLink = findMagnetLink();
      const year = findYear();
      const title = deriveTitle(year);

      sendResponse({ magnetLink, year, title });
    }
  });
})();
