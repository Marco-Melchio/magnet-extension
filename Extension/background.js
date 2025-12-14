browser.runtime.onMessage.addListener(async (msg) => {
  if (msg.type !== "SEND_TO_NAS") return;

  const { payload } = msg;
  const token = payload.token?.trim();
  const { token: _unusedToken, ...payloadWithoutToken } = payload;
  const requestBody = JSON.stringify(token ? payload : payloadWithoutToken);

  console.log("[Background] Sende an NAS:", payload);
  console.log("[Background] Magnet:", payload.magnet);

  try {
    let res;
    try {
      // Normaler Versuch mit CORS (erlaubt das Lesen der Antwort)
      res = await fetch(payload.receiverUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Auth-Token": token } : {})
        },
        body: requestBody
      });
    } catch (err) {
      // Fallback für NAS-Server ohne CORS-Header
      console.warn("[Background] CORS-Fehler, versuche erneut mit no-cors", err);
      res = await fetch(payload.receiverUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Auth-Token": token } : {})
        },
        body: requestBody
      });
    }

    if (res && res.ok) {
      const text = await res.text();
      console.log("[Background] NAS Antwort:", text);
    } else {
      console.warn("[Background] Anfrage gesendet, aber Antwort nicht lesbar (no-cors?)");
    }
  } catch (err) {
    console.error("[Background] Fehler beim Senden:", err);
  }
});
