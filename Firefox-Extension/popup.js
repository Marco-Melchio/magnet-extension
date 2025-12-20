const extensionApi = typeof browser !== 'undefined' ? browser : chrome;

const magnetInput = document.getElementById('magnetLink');
const yearInput = document.getElementById('year');
const titleInput = document.getElementById('title');
const nasUrlInput = document.getElementById('nasUrl');
const nasTokenInput = document.getElementById('nasToken');
const statusEl = document.getElementById('status');
const toastEl = document.getElementById('toast');
const refreshBtn = document.getElementById('refresh');
const sendBtn = document.getElementById('send');
const categoryButtons = Array.from(document.querySelectorAll('.pill'));

let toastTimeout;

const DEFAULT_CATEGORY = 'Movies';

function setStatus(message, state = 'ready') {
  statusEl.textContent = message;
  statusEl.className = `status-chip status-${state}`;

  if (state === 'error') {
    showToast(message);
  } else {
    hideToast();
  }
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 3000);
}

function hideToast() {
  toastEl.classList.remove('show');
  clearTimeout(toastTimeout);
}

async function getActiveTab() {
  const tabs = await extensionApi.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function loadNasSettings() {
  return new Promise((resolve) => {
    extensionApi.runtime.sendMessage({ type: 'getNasSettings' }, (response) => {
      if (response && response.ok) {
        nasUrlInput.value = response.nasUrl || '';
        nasTokenInput.value = response.nasToken || '';
        setSelectedCategory(response.category || DEFAULT_CATEGORY);
        resolve(response);
      } else {
        setSelectedCategory(DEFAULT_CATEGORY);
        resolve({ nasUrl: '', nasToken: '', category: DEFAULT_CATEGORY });
      }
    });
  });
}

function saveNasUrl(value) {
  extensionApi.runtime.sendMessage({ type: 'saveNasUrl', url: value });
}

function saveNasToken(value) {
  extensionApi.runtime.sendMessage({ type: 'saveNasToken', token: value });
}

function debounce(fn, delay = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

function setSelectedCategory(category) {
  const target = category || DEFAULT_CATEGORY;
  categoryButtons.forEach((button) => {
    const isActive = button.dataset.category === target;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive);
  });
}

function getSelectedCategory() {
  const active = categoryButtons.find((button) => button.classList.contains('active'));
  return (active && active.dataset.category) || DEFAULT_CATEGORY;
}

function saveCategory(category) {
  extensionApi.runtime.sendMessage({ type: 'saveCategory', category });
}

async function collectData() {
  setStatus('Searching', 'searching');
  const tab = await getActiveTab();

  return new Promise((resolve) => {
    extensionApi.tabs.sendMessage(tab.id, { type: 'collectData' }, (response) => {
      if (!response) {
        setStatus('Inactive', 'inactive');
        resolve(null);
        return;
      }

      magnetInput.value = response.magnetLink || '';
      yearInput.value = response.year || '';
      titleInput.value = response.title || '';
      setStatus('Ready', 'ready');
      resolve(response);
    });
  });
}

async function sendToNas() {
  const magnetLink = magnetInput.value.trim();
  const title = titleInput.value.trim() || 'Untitled';
  const year = yearInput.value.trim();
  const nasUrl = nasUrlInput.value.trim();
  const nasToken = nasTokenInput.value.trim();
  const category = getSelectedCategory();

  if (!magnetLink) {
    setStatus('No magnet link found.', 'error');
    return;
  }
  if (!nasUrl) {
    setStatus('Please provide the NAS API URL.', 'error');
    return;
  }

  setStatus('Sending', 'sending');
  saveNasUrl(nasUrl);
  saveNasToken(nasToken);

  extensionApi.runtime.sendMessage(
    {
      type: 'sendToNAS',
      payload: { magnetLink, title, year, nasUrl, nasToken, category }
    },
    (response) => {
      if (!response) {
        setStatus('No response from the background script.', 'error');
        return;
      }

      if (response.ok) {
        setStatus('Done', 'done');
      } else {
        setStatus(response.error || 'Error while sending.', 'error');
      }
    }
  );
}

refreshBtn.addEventListener('click', collectData);
sendBtn.addEventListener('click', sendToNas);
const debouncedSaveNasUrl = debounce((value) => saveNasUrl(value));
const debouncedSaveNasToken = debounce((value) => saveNasToken(value));

nasUrlInput.addEventListener('input', (event) => debouncedSaveNasUrl(event.target.value));
nasTokenInput.addEventListener('input', (event) => debouncedSaveNasToken(event.target.value));

categoryButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setSelectedCategory(button.dataset.category);
    saveCategory(button.dataset.category);
  });
});

document.addEventListener('DOMContentLoaded', async () => {
  await loadNasSettings();
  await collectData();
});

function startRefreshAnimation() {
  refreshBtn.classList.add('playing');
}

function stopRefreshAnimation() {
  refreshBtn.classList.remove('playing');
}

refreshBtn.addEventListener('mouseenter', startRefreshAnimation);
refreshBtn.addEventListener('focus', startRefreshAnimation);
refreshBtn.addEventListener('mouseleave', stopRefreshAnimation);
refreshBtn.addEventListener('blur', stopRefreshAnimation);
