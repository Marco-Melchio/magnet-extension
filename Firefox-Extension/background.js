const extensionApi = typeof browser !== 'undefined' ? browser : chrome;
const DEFAULT_NAS_URL = '';
const DEFAULT_NAS_TOKEN = '';
const DEFAULT_CATEGORY = 'Movies';

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

function getStoredCategory() {
  return new Promise((resolve) => {
    extensionApi.storage.local.get({ category: DEFAULT_CATEGORY }, (items) => {
      resolve(items.category || DEFAULT_CATEGORY);
    });
  });
}

function setStoredCategory(category) {
  return new Promise((resolve) => {
    extensionApi.storage.local.set({ category }, () => resolve(category));
  });
}

async function getStoredNasSettings() {
  const [nasUrl, nasToken, category] = await Promise.all([
    getStoredNasUrl(),
    getStoredNasToken(),
    getStoredCategory()
  ]);
  return { nasUrl, nasToken, category };
}

async function sendToNas({ magnetLink, title, year, nasUrl, nasToken, category }) {
  const url = nasUrl || (await getStoredNasUrl());
  const token = nasToken || (await getStoredNasToken());
  const targetCategory = category || (await getStoredCategory()) || DEFAULT_CATEGORY;

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
    folder: folderName,
    category: targetCategory
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
    getStoredNasSettings().then(({ nasUrl, nasToken, category }) => sendResponse({ ok: true, nasUrl, nasToken, category }));
    return true;
  }

  if (message.type === 'saveCategory') {
    setStoredCategory(message.category || DEFAULT_CATEGORY).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'getCategory') {
    getStoredCategory().then((category) => sendResponse({ ok: true, category }));
    return true;
  }

  return false;
});
