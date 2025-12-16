const extensionApi = typeof browser !== 'undefined' ? browser : chrome;
const DEFAULT_NAS_URL = 'http://nas-frey:5050/api/magnet';
const DEFAULT_NAS_TOKEN = 'a9F3kL2M0s8xQeVbC7D5PZJYwE6R4t1U';

function getStoredNasUrl() {
  return new Promise((resolve) => {
    extensionApi.storage.sync.get({ nasUrl: DEFAULT_NAS_URL }, (items) => {
      resolve(items.nasUrl || '');
    });
  });
}

function setStoredNasUrl(url) {
  return new Promise((resolve) => {
    extensionApi.storage.sync.set({ nasUrl: url }, () => resolve(url));
  });
}

function getStoredNasToken() {
  return new Promise((resolve) => {
    extensionApi.storage.sync.get({ nasToken: DEFAULT_NAS_TOKEN }, (items) => {
      resolve(items.nasToken || '');
    });
  });
}

function setStoredNasToken(token) {
  return new Promise((resolve) => {
    extensionApi.storage.sync.set({ nasToken: token }, () => resolve(token));
  });
}

async function getStoredNasSettings() {
  const [nasUrl, nasToken] = await Promise.all([getStoredNasUrl(), getStoredNasToken()]);
  return { nasUrl, nasToken };
}

async function sendToNas({ magnetLink, title, year, nasUrl, nasToken }) {
  const url = nasUrl || (await getStoredNasUrl());
  const token = nasToken || (await getStoredNasToken());

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

  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
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

  if (message.type === 'saveNasToken') {
    setStoredNasToken(message.token).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'getNasUrl') {
    getStoredNasUrl().then((nasUrl) => sendResponse({ ok: true, nasUrl }));
    return true;
  }

  if (message.type === 'getNasToken') {
    getStoredNasToken().then((nasToken) => sendResponse({ ok: true, nasToken }));
    return true;
  }

  if (message.type === 'getNasSettings') {
    getStoredNasSettings().then(({ nasUrl, nasToken }) => sendResponse({ ok: true, nasUrl, nasToken }));
    return true;
  }

  return false;
});
