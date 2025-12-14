const RECEIVER_URLS = ["http://192.168.0.220:8787/*"];

function upsertHeader(headers, name, value) {
  const existing = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.value = value;
  } else {
    headers.push({ name, value });
  }
  return headers;
}

function enableCorsForReceiver() {
  try {
    browser.webRequest.onHeadersReceived.addListener(
      (details) => {
        const headers = upsertHeader(details.responseHeaders || [], "Access-Control-Allow-Origin", "*");
        upsertHeader(headers, "Access-Control-Allow-Headers", "*");
        upsertHeader(headers, "Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        return { responseHeaders: headers };
      },
      { urls: RECEIVER_URLS },
      ["blocking", "responseHeaders"]
    );
  } catch (err) {
    console.error("[Background] Konnte CORS-Header nicht setzen:", err);
  }
}

enableCorsForReceiver();

browser.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "SEND_TO_NAS") return;

  const { payload } = msg;
  console.log("[Background] Sende an NAS:", payload);

  return (async () => {
    try {
      const res = await fetch(payload.receiverUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(payload.token ? { "X-Auth-Token": payload.token } : {})
        },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      console.log("[Background] NAS Antwort:", text);

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        parsed = null;
      }

      if (res.ok) {
        return parsed || { ok: true, createdFolder: null };
      }

      return {
        ok: false,
        status: res.status,
        error: (parsed && parsed.error) || text || "NAS Meldung unbekannt"
      };
    } catch (err) {
      console.error("[Background] Fehler beim Senden:", err);
      return { ok: false, error: err?.message || String(err) };
    }
  })();
});
