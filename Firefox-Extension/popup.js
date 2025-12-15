const extensionApi = typeof browser !== 'undefined' ? browser : chrome;

const magnetInput = document.getElementById('magnetLink');
const yearInput = document.getElementById('year');
const titleInput = document.getElementById('title');
const nasUrlInput = document.getElementById('nasUrl');
const statusEl = document.getElementById('status');
const toastEl = document.getElementById('toast');
const refreshBtn = document.getElementById('refresh');
const refreshGif = document.getElementById('refreshGif');
const sendBtn = document.getElementById('send');

let toastTimeout;

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

async function loadNasUrl() {
  return new Promise((resolve) => {
    extensionApi.runtime.sendMessage({ type: 'getNasUrl' }, (response) => {
      if (response && response.ok) {
        nasUrlInput.value = response.nasUrl || '';
        resolve(response.nasUrl || '');
      } else {
        resolve('');
      }
    });
  });
}

function saveNasUrl(value) {
  extensionApi.runtime.sendMessage({ type: 'saveNasUrl', url: value });
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

  extensionApi.runtime.sendMessage(
    {
      type: 'sendToNAS',
      payload: { magnetLink, title, year, nasUrl }
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
nasUrlInput.addEventListener('change', (event) => saveNasUrl(event.target.value));

document.addEventListener('DOMContentLoaded', async () => {
  await loadNasUrl();
  await collectData();
});

function startRefreshAnimation() {
  if (!refreshGif) return;
  if (!refreshGif.src) {
    refreshGif.src = refreshGif.dataset.src;
  }
  refreshBtn.classList.add('playing');
}

function stopRefreshAnimation() {
  refreshBtn.classList.remove('playing');
  if (refreshGif) {
    refreshGif.removeAttribute('src');
  }
}

refreshBtn.addEventListener('mouseenter', startRefreshAnimation);
refreshBtn.addEventListener('focus', startRefreshAnimation);
refreshBtn.addEventListener('mouseleave', stopRefreshAnimation);
refreshBtn.addEventListener('blur', stopRefreshAnimation);
