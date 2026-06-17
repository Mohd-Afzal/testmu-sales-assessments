/**
 * api.js — thin wrapper around the Apps Script backend.
 *
 * Cross-origin note: we send the body as Content-Type "text/plain" on purpose.
 * That keeps the request "simple" so the browser does NOT fire a CORS preflight
 * (OPTIONS), which Apps Script web apps cannot answer. The payload is still JSON.
 */
const Api = (() => {
  function getIdToken() {
    const t = window.AppState && window.AppState.idToken;
    if (!t) throw new Error("You are not signed in.");
    return t;
  }

  async function call(action, payload) {
    const url = window.APP_CONFIG.APPS_SCRIPT_URL;
    if (!url || url.indexOf("REPLACE_") === 0) {
      throw new Error("Backend not configured yet (APPS_SCRIPT_URL in config.js).");
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ action, idToken: getIdToken() }, payload || {})),
      redirect: "follow",
    });
    if (!res.ok) throw new Error("Server error (" + res.status + ").");
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  return {
    getAttempts: () => call("getAttempts"),
    submit: (payload) => call("submit", payload),
    dashboard: () => call("dashboard"),
  };
})();
