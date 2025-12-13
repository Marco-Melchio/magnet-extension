// popup.js
document.addEventListener("DOMContentLoaded", () => {
  if (!$("receiver").value) {
    $("receiver").value = "http://192.168.0.220:8787/intake";
  }
});

const $ = (id) => document.getElementById(id);

function setStatus(msg) {
    $("status").textContent = msg;
}

async function getActiveTab() {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
}

// ----------------------
// Titel-Bereinigung
// ----------------------
function extractTitleAndYear(raw) {
    if (!raw) return { title: "", year: "" };

    let s = String(raw).trim();

    // Jahr erkennen (1900–2099)
    const yearMatch = s.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : "";

    // Alles AB dem Jahr abschneiden
    if (yearMatch) {
        s = s.substring(0, yearMatch.index);
    }

    // Trennzeichen vereinheitlichen
    s = s.replace(/[._-]+/g, " ");

    // Mehrfach-Leerzeichen entfernen
    s = s.replace(/\s+/g, " ").trim();

    // Title Case
    s = s.replace(/\b\w/g, c => c.toUpperCase());

    return {
        title: s,
        year
    };
}

// ----------------------
// Auto-Fill
// ----------------------
$("autofill").addEventListener("click", async () => {
    const tab = await getActiveTab();
    const data = await browser.tabs.sendMessage(tab.id, { type: "EXTRACT" });

    if (!data) {
        setStatus("Keine Daten erhalten (Content-Script evtl. nicht aktiv).");
        return;
    }

    // Titel bewusst NICHT automatisch setzen
    // Optional: Jahr übernehmen, wenn es geliefert wird
    if (data.year && !$("year").value) {
        $("year").value = String(data.year).trim();
    }

    // Debug: Magnet anzeigen
    if (data.magnet) {
        window.__LAST_MAGNET__ = data.magnet;
        console.log("[Popup] Magnet-Link:", data.magnet);
    } else {
        console.warn("[Popup] Kein Magnet-Link gefunden");
    }

    if ($("type").value === "auto") {
        setStatus(`Auto-Fill OK. Typ-Vorschlag: ${data.typeGuess || "?"}`);
    } else {
        setStatus("Auto-Fill OK.");
    }
});

// ----------------------
// Senden an Background
// ----------------------
$("send").addEventListener("click", async () => {
    const tab = await getActiveTab();

    let magnet = window.__LAST_MAGNET__ || null;
    let pageUrl = tab?.url || null;
    let title = $("title").value.trim();
    let year = $("year").value.trim();
    let type = $("type").value === "auto" ? undefined : $("type").value;

    // Fallback: direkt zur Laufzeit aus dem Content-Script holen
    if (!magnet || !title || !year || !type) {
        try {
            const extracted = await browser.tabs.sendMessage(tab.id, { type: "EXTRACT" });
            if (extracted) {
                magnet = magnet || extracted.magnet || null;
                pageUrl = pageUrl || extracted.pageUrl || null;
                if (!title) title = extracted.title || "";
                if (!year) year = extracted.year || "";
                if (!type) type = extracted.typeGuess || undefined;
            }
        } catch (err) {
            console.warn("[Popup] Konnte Content-Script nicht erreichen:", err);
        }
    }

    const payload = {
        title,
        year,
        type,
        receiverUrl: $("receiver").value.trim(),
        token: $("token").value.trim(),
        magnet,
        pageUrl
    };

    if (!payload.magnet) {
        setStatus("Kein Magnet-Link gefunden.");
        console.warn("[Popup] Abbruch: kein Magnet-Link im Payload", payload);
        return;
    }

    console.log("[Popup] Sende Payload:", payload);

    try {
        await browser.runtime.sendMessage({
            type: "SEND_TO_NAS",
            payload
        });

        setStatus("Gesendet.");
    } catch (err) {
        console.error("[Popup] Fehler beim Senden:", err);
        setStatus("Senden fehlgeschlagen.");
    }
});

// ----------------------
// Magnet aus Content-Script speichern
// ----------------------
browser.runtime.onMessage.addListener((msg) => {
    if (msg.type === "MAGNET_FOUND") {
        window.__LAST_MAGNET__ = msg.magnet;
        console.log("[Popup] Magnet gespeichert:", msg.magnet);
    }
});
