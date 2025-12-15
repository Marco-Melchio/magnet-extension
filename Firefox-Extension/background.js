const extensionApi = typeof browser !== 'undefined' ? browser : chrome;
function getStoredNasUrl() {
  return new Promise((resolve) => {
    extensionApi.storage.sync.get({ nasUrl: '' }, (items) => {
      resolve(items.nasUrl || '');
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

  if (!url) {
    throw new Error('NAS API URL is missing.');
  }

  const targetTitle = title || 'Untitled';
  const parsedYear = Number.parseInt(year, 10);
  const normalizedYear = Number.isFinite(parsedYear) ? parsedYear : undefined;
  const folderName = normalizedYear ? `${targetTitle} (${normalizedYear})` : targetTitle;

  const payload = {
    magnet: magnetLink,
    title: targetTitle,
    year: normalizedYear,
    folder: folderName
  };

  const response = await fetch(url, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`NAS response ${response.status}: ${text || 'unknown error'}`);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return { message: text || 'Request succeeded' };
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
