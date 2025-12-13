browser.runtime.onMessage.addListener(async (msg) => {
  if (msg.type !== "SEND_TO_NAS") return;

  const { payload } = msg;

  console.log("[Background] Sende an NAS:", payload);
  console.log("[Background] Magnet:", payload.magnet);

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
  } catch (err) {
    console.error("[Background] Fehler beim Senden:", err);
  }
});
