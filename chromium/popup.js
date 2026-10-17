async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https?:/.test(tab.url || '')) { alert('Open a regular website tab (http/https) first'); return null; }
  return tab;
}
async function start(all) {
  const tab = await activeTab(); if (!tab) return;
  const q = new URLSearchParams({ url: tab.url, depth: all ? '50' : '0', max: all ? '500' : '1', js: '1' });
  chrome.tabs.create({ url: chrome.runtime.getURL('crawler.html') + '?' + q });
  window.close();
}
async function pick() {
  const tab = await activeTab(); if (!tab) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['picker.js'] });
    window.close();
  } catch (e) { alert('Could not start the element picker on this page: ' + e.message); }
}
document.getElementById('pick').addEventListener('click', pick);
document.getElementById('one').addEventListener('click', () => start(false));
document.getElementById('all').addEventListener('click', () => start(true));
