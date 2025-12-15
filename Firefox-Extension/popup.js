const extensionApi = typeof browser !== 'undefined' ? browser : chrome;

const magnetInput = document.getElementById('magnetLink');
const yearInput = document.getElementById('year');
const titleInput = document.getElementById('title');
const nasUrlInput = document.getElementById('nasUrl');
const statusEl = document.getElementById('status');
const refreshBtn = document.getElementById('refresh');
const sendBtn = document.getElementById('send');

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
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
  setStatus('Lese Daten aus der Seite...');
  const tab = await getActiveTab();

  return new Promise((resolve) => {
    extensionApi.tabs.sendMessage(tab.id, { type: 'collectData' }, (response) => {
      if (!response) {
        setStatus('Keine Daten gefunden. Versuche es nach dem Laden der Seite erneut.', true);
        resolve(null);
        return;
      }

      magnetInput.value = response.magnetLink || '';
      yearInput.value = response.year || '';
      titleInput.value = response.title || '';
      setStatus('Bereit');
      resolve(response);
    });
  });
}

async function sendToNas() {
  const magnetLink = magnetInput.value.trim();
  const title = titleInput.value.trim() || 'Unbenannt';
  const year = yearInput.value.trim();
  const nasUrl = nasUrlInput.value.trim();

  if (!magnetLink) {
    setStatus('Kein Magnet-Link gefunden.', true);
    return;
  }
  if (!nasUrl) {
    setStatus('Bitte NAS API URL angeben.', true);
    return;
  }

  setStatus('Sende an NAS...');
  saveNasUrl(nasUrl);

  extensionApi.runtime.sendMessage(
    {
      type: 'sendToNAS',
      payload: { magnetLink, title, year, nasUrl }
    },
    (response) => {
      if (!response) {
        setStatus('Keine Antwort vom Hintergrundskript.', true);
        return;
      }

      if (response.ok) {
        setStatus('Erfolgreich gesendet.');
      } else {
        setStatus(response.error || 'Fehler beim Senden.', true);
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
