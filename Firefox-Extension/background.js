const extensionApi = typeof browser !== 'undefined' ? browser : chrome;
const DEFAULT_NAS_URL = 'http://nas-frey:5050/api/magnet';

function getStoredNasUrl() {
  return new Promise((resolve) => {
    extensionApi.storage.sync.get({ nasUrl: DEFAULT_NAS_URL }, (items) => {
      resolve(items.nasUrl || DEFAULT_NAS_URL);
    });
  });
}

function setStoredNasUrl(url) {
  return new Promise((resolve) => {
    extensionApi.storage.sync.set({ nasUrl: url }, () => resolve(url));
  });
}

async function sendToNas({ magnetLink, title, year, nasUrl }) {
  const url = nasUrl || (await getStoredNasUrl());
  const targetTitle = title || 'Unbenannt';
  const parsedYear = Number.parseInt(year, 10);
  const normalizedYear = Number.isFinite(parsedYear) ? parsedYear : undefined;
  const folderName = normalizedYear ? `${targetTitle} (${normalizedYear})` : targetTitle;

  const payload = {
    magnet: magnetLink,
    title: targetTitle,
    year: normalizedYear,
    folder: `/EmblyFiles/Movies/${folderName}`
  };

  const response = await fetch(url, {
    method: 'POST',
    
    headers: {
      'Authorization': 'Bearer a9F3kL2M0s8xQeVbC7D5PZJYwE6R4t1U',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`NAS Antwort ${response.status}: ${text || 'unbekannter Fehler'}`);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return { message: text || 'Anfrage erfolgreich' };
  }
}

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === 'sendToNAS') {
    sendToNas(message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true; // async
  }

  if (message.type === 'saveNasUrl') {
    setStoredNasUrl(message.url).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'getNasUrl') {
    getStoredNasUrl().then((nasUrl) => sendResponse({ ok: true, nasUrl }));
    return true;
  }

  return false;
});
