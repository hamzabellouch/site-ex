const api = globalThis.browser || globalThis.chrome;

// Toggle floating toolbar when user clicks the extension action icon
api.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id || !/^https?:/.test(tab.url || '')) return;
  try {
    await api.tabs.sendMessage(tab.id, { type: 'toggleToolbar' });
  } catch {
    try {
      await api.scripting.executeScript({ target: { tabId: tab.id }, files: ['toolbar.js'] });
      await api.tabs.sendMessage(tab.id, { type: 'toggleToolbar' });
    } catch (e) {
      console.error('Could not inject toolbar:', e);
    }
  }
});

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'fetchText') {
    fetch(msg.url, { credentials: 'include' })
      .then(async (r) => {
        const t = await r.text();
        sendResponse({ ok: r.ok, text: t.slice(0, 4000000) });
      })
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg && msg.type === 'pickResult') {
    api.storage.local.set({ lastPick: msg.bundle })
      .then(() => api.tabs.create({ url: api.runtime.getURL('result.html') }))
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg && msg.type === 'startCrawl') {
    const q = new URLSearchParams({
      url: msg.url,
      depth: msg.all ? '50' : '0',
      max: msg.all ? '500' : '1',
      js: '1'
    });
    api.tabs.create({ url: api.runtime.getURL('crawler.html') + '?' + q })
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg && msg.type === 'startPicker') {
    const tabId = sender?.tab?.id;
    if (tabId) {
      api.scripting.executeScript({ target: { tabId }, files: ['picker.js'] })
        .then(() => sendResponse({ ok: true }))
        .catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true;
    }
  }
});
