// popup.js
const state = {
  magnet: null,
  pageUrl: null,
  typeGuess: null
};

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  if (!$("receiver").value) {
    $("receiver").value = "http://192.168.0.220:8787/intake";
  }
});

function setStatus(msg, kind = "info") {
  const el = $("status");
  el.textContent = msg || "";
  el.classList.remove("ok", "error");
  if (kind === "ok") el.classList.add("ok");
  if (kind === "error") el.classList.add("error");
}

function setMagnetPreview(magnet) {
  const pill = $("magnetPreview");
  const value = $("magnetValue");
  if (magnet) {
    value.textContent = magnet;
    pill.hidden = false;
  } else {
    value.textContent = "";
    pill.hidden = true;
  }
}

async function getActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

// ----------------------
// Titel-Bereinigung
// ----------------------
function extractTitleAndYear(raw, fallbackYear) {
  if (!raw) return { title: "", year: fallbackYear || "" };

  let s = String(raw).trim();

  const yearMatch = s.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : fallbackYear || "";

  if (yearMatch) {
    s = s.substring(0, yearMatch.index);
  }

  s = s.replace(/[._-]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/\b\w/g, (c) => c.toUpperCase());

  return { title: s, year };
}

async function fetchPageData() {
  const tab = await getActiveTab();
  const data = await browser.tabs.sendMessage(tab.id, { type: "EXTRACT" });
  if (data) {
    state.pageUrl = data.pageUrl || tab.url;
    state.typeGuess = data.typeGuess || null;
  }
  return data;
}

// ----------------------
// Auto-Fill
// ----------------------
$("autofill").addEventListener("click", async () => {
  setStatus("Hole Daten von der Seite...");

  let data;
  try {
    data = await fetchPageData();
  } catch (err) {
    console.error("[Popup] Auto-Fill Fehler:", err);
    setStatus("Auto-Fill fehlgeschlagen (Content Script?)", "error");
    return;
  }

  if (!data) {
    setStatus("Keine Daten erhalten (Content-Script evtl. nicht aktiv).", "error");
    return;
  }

  const cleaned = extractTitleAndYear(data.title || data.raw, data.year);
  $("title").value = cleaned.title || data.title || "";
  $("year").value = cleaned.year || "";

  if (data.magnet) {
    state.magnet = data.magnet;
    setMagnetPreview(data.magnet);
    console.log("[Popup] Magnet-Link:", data.magnet);
  } else {
    console.warn("[Popup] Kein Magnet-Link gefunden");
  }

  if ($("type").value === "auto" && data.typeGuess) {
    $("type").value = data.typeGuess;
  }

  const typeText = $("type").value === "auto" ? "Auto" : $("type").value;
  setStatus(`Auto-Fill OK. Typ: ${typeText}${cleaned.year ? `, Jahr: ${cleaned.year}` : ""}`, "ok");
});

// ----------------------
// Senden an Background
// ----------------------
$("send").addEventListener("click", async () => {
  if (!state.magnet) {
    setStatus("Kein Magnet-Link gefunden. Bitte zuerst Auto-Fill nutzen.", "error");
    return;
  }

  const payload = {
    title: $("title").value.trim(),
    year: $("year").value.trim(),
    type: $("type").value === "auto" ? state.typeGuess || "movie" : $("type").value,
    receiverUrl: $("receiver").value.trim(),
    token: $("token").value.trim(),
    magnet: state.magnet,
    pageUrl: state.pageUrl
  };

  if (!payload.title) {
    setStatus("Bitte einen Namen/Titel eingeben.", "error");
    return;
  }

  setStatus("Sende an NAS...");
  console.log("[Popup] Sende Payload:", payload);

  try {
    const res = await browser.runtime.sendMessage({
      type: "SEND_TO_NAS",
      payload
    });

    if (res?.ok) {
      const folder = res.createdFolder ? `Ordner: ${res.createdFolder}` : "";
      setStatus(`Download angestossen. ${folder}`.trim(), "ok");
    } else {
      const errMsg = res?.error || "NAS-Antwort war negativ.";
      setStatus(errMsg, "error");
    }
  } catch (err) {
    console.error("[Popup] Fehler beim Senden:", err);
    setStatus("Senden fehlgeschlagen. NAS erreichbar?", "error");
  }
});

// ----------------------
// Magnet aus Content-Script speichern
// ----------------------
browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === "MAGNET_FOUND") {
    state.magnet = msg.magnet;
    setMagnetPreview(msg.magnet);
    console.log("[Popup] Magnet gespeichert:", msg.magnet);
  }
});
