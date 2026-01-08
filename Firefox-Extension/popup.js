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
const categorySelect = document.getElementById('category');
const seasonInput = document.getElementById('season');
const episodeInput = document.getElementById('episode');
const seriesMetaSection = document.getElementById('seriesMeta');

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
  const availableOptions = Array.from(categorySelect.options).map((option) => option.value);
  categorySelect.value = availableOptions.includes(target) ? target : DEFAULT_CATEGORY;
}

function getSelectedCategory() {
  return categorySelect.value || DEFAULT_CATEGORY;
}

function isSeriesCategory(category) {
  return category === 'Series' || category === 'AnimeSeries';
}

function toggleSeriesInputs(category) {
  const shouldShow = isSeriesCategory(category);
  seriesMetaSection.classList.toggle('is-hidden', !shouldShow);
  seasonInput.disabled = !shouldShow;
  episodeInput.disabled = !shouldShow;
  seasonInput.required = shouldShow;
  if (!shouldShow) {
    seasonInput.setCustomValidity('');
    episodeInput.setCustomValidity('');
  }
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
  const seasonValue = seasonInput.value.trim();
  const episodeValue = episodeInput.value.trim();

  if (!magnetLink) {
    setStatus('No magnet link found.', 'error');
    return;
  }
  if (!nasUrl) {
    setStatus('Please provide the NAS API URL.', 'error');
    return;
  }
  if (isSeriesCategory(category)) {
    if (!seasonValue) {
      setStatus('Season is required for series.', 'error');
      seasonInput.focus();
      return;
    }
    if (!/^\d+$/.test(seasonValue)) {
      setStatus('Season must be a valid number.', 'error');
      seasonInput.focus();
      return;
    }
    if (episodeValue && !/^\d+$/.test(episodeValue)) {
      setStatus('Episode must be a valid number.', 'error');
      episodeInput.focus();
      return;
    }
  }

  setStatus('Sending', 'sending');
  saveNasUrl(nasUrl);
  saveNasToken(nasToken);

  const season = isSeriesCategory(category) && seasonValue ? Number.parseInt(seasonValue, 10) : undefined;
  const episode = isSeriesCategory(category) && episodeValue ? Number.parseInt(episodeValue, 10) : undefined;

  extensionApi.runtime.sendMessage(
    {
      type: 'sendToNAS',
      payload: { magnetLink, title, year, nasUrl, nasToken, category, season, episode }
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

categorySelect.addEventListener('change', (event) => {
  const selectedCategory = event.target.value;
  setSelectedCategory(selectedCategory);
  saveCategory(selectedCategory);
  toggleSeriesInputs(selectedCategory);
});

document.addEventListener('DOMContentLoaded', async () => {
  await loadNasSettings();
  toggleSeriesInputs(getSelectedCategory());
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
