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
