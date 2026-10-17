const api = globalThis.browser || globalThis.chrome;
const params = new URLSearchParams(location.search);
const startUrl = params.get('url');
const maxDepth = Math.max(0, +params.get('depth') || 0);
const maxPages = Math.max(1, +params.get('max') || 10);
const keepJs = params.get('js') !== '0';
const ORIGIN = new URL(startUrl).origin;
const MAX_ASSET = 15 * 1024 * 1024;

const logEl = document.getElementById('log');
const statusEl = document.getElementById('status');
const log = (m) => { logEl.textContent += m + '\n'; logEl.scrollTop = logEl.scrollHeight; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);

const files = new Map();       // path inside ZIP -> content
const failed = [];
const assetCache = new Map();  // url -> Promise(local path | null)
const usedPaths = new Map();   // path -> url

const skipHost = /(google-analytics|googletagmanager|doubleclick|googlesyndication|facebook\.net|hotjar|clarity\.ms|segment\.(io|com)|sentry)/i;
const skipExt = /\.(pdf|zip|rar|7z|png|jpe?g|gif|webp|svg|mp4|mp3|avi|mov|docx?|xlsx?|pptx?|exe|apk|dmg)$/i;

/* ---------- helpers ---------- */
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(0, 6);
}
function cleanSeg(s) {
  try { s = decodeURIComponent(s); } catch {}
  s = s.replace(/[<>:"\\|?*\x00-\x1f]/g, '_');
  if (s.length > 80) {
    const i = s.lastIndexOf('.');
    const ext = i > 0 && s.length - i <= 8 ? s.slice(i) : '';
    s = s.slice(0, 70) + '_' + hash(s) + ext;
  }
  return s || '_';
}
function extFromType(ct) {
  ct = (ct || '').toLowerCase();
  if (ct.includes('css')) return '.css';
  if (ct.includes('javascript')) return '.js';
  if (ct.includes('json')) return '.json';
  if (ct.includes('woff2')) return '.woff2';
  if (ct.includes('woff')) return '.woff';
  if (ct.includes('svg')) return '.svg';
  const m = ct.match(/image\/(png|jpeg|gif|webp|avif)/);
  return m ? '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]) : '';
}
function rel(from, to) {
  const f = from.split('/').slice(0, -1), t = to.split('/');
  let i = 0;
  while (i < f.length && f[i] === t[i]) i++;
  return '../'.repeat(f.length - i) + t.slice(i).join('/');
}
const norm = (u) => { const x = new URL(u); x.hash = ''; return x.href; };

let active = 0; const waiters = [];
async function limited(fn) {
  while (active >= 8) await new Promise((r) => waiters.push(r));
  active++;
  try { return await fn(); } finally { active--; const w = waiters.shift(); if (w) w(); }
}

/* ---------- file paths (keeps the original site structure) ---------- */
function assetPathFor(url, ct) {
  const u = new URL(url);
  const same = u.origin === ORIGIN;
  let segs = u.pathname.split('/').filter(Boolean).map(cleanSeg);
  if (!segs.length) segs = ['file'];
  const last = segs[segs.length - 1];
  const m = last.match(/^(.*?)(\.[A-Za-z0-9]{1,6})?$/);
  let name = m[1], ext = m[2] || '';
  if (!ext) ext = extFromType(ct);
  if (u.search && (!same || !m[2])) name += '_' + hash(u.search);
  segs[segs.length - 1] = name + ext;
  return (same ? '' : '_external/' + cleanSeg(u.host) + '/') + segs.join('/');
}

function pagePath(url) {
  const u = new URL(url);
  const segs = u.pathname.split('/').filter(Boolean).map(cleanSeg);
  const q = u.search ? '_' + hash(u.search) : '';
  if (!segs.length) return 'index' + q + '.html';
  const last = segs[segs.length - 1];
  if (/\.html?$/i.test(last)) segs[segs.length - 1] = last.replace(/\.html?$/i, q + '.html');
  else if (/\.[A-Za-z0-9]{1,5}$/.test(last)) segs[segs.length - 1] = last.replace(/\.[^.]+$/, q + '.html');
  else segs.push('index' + q + '.html');
  return segs.join('/');
}

/* ---------- downloading assets and processing CSS ---------- */
async function processCss(text, base, selfPath) {
  const re = /url\(\s*(['"]?)(.*?)\1\s*\)|@import\s+(['"])(.*?)\3/g;
  const matches = [...text.matchAll(re)];
  const reps = await Promise.all(matches.map(async (m) => {
    const ref = m[2] ?? m[4];
    if (!ref || /^(data:|#|blob:)/i.test(ref.trim())) return null;
    let abs; try { abs = new URL(ref, base).href; } catch { return null; }
    if (!/^https?:/.test(abs)) return null;
    const p = await getAsset(abs);
    return p ? rel(selfPath, p) : null;
  }));
  let i = 0;
  return text.replace(re, (m0) => {
    const r = reps[i++];
    if (!r) return m0;
    return m0.startsWith('@import') ? `@import "${r}"` : `url("${r}")`;
  });
}

function getAsset(url) {
  if (assetCache.has(url)) return assetCache.get(url);
  const p = (async () => {
    try {
      if (skipHost.test(new URL(url).hostname)) return null;
      const r = await limited(() => fetch(url, { credentials: 'include' }));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if ((+r.headers.get('content-length') || 0) > MAX_ASSET) throw new Error('file too large');
      const ct = r.headers.get('content-type') || '';
      let path = assetPathFor(url, ct);
      if (usedPaths.has(path) && usedPaths.get(path) !== url) {
        path = path.replace(/(\.[^./]*)?$/, (m) => '_' + hash(url) + m);
      }
      usedPaths.set(path, url);
      if (/text\/css/i.test(ct) || /\.css$/i.test(path)) {
        files.set(path, '');
        files.set(path, await processCss(await r.text(), r.url || url, path));
      } else {
        files.set(path, await r.arrayBuffer());
      }
      log('✓ ' + url);
      return path;
    } catch (e) {
      failed.push(url + ' — ' + e.message);
      log('✗ ' + url);
      return null;
    }
  })();
  assetCache.set(url, p);
  return p;
}

/* ---------- injected into the live page ---------- */
async function captureInPage() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    const total = Math.min(document.documentElement.scrollHeight, 20000);
    const step = Math.max(600, window.innerHeight);
    for (let y = 0; y < total; y += step) { window.scrollTo(0, y); await sleep(100); }
    window.scrollTo(0, 0);
  } catch (e) {}
  let last = -1, stable = 0;
  for (let i = 0; i < 10 && stable < 3; i++) {
    const n = performance.getEntriesByType('resource').length;
    if (n === last) stable++; else { stable = 0; last = n; }
    await sleep(300);
  }
  const clone = document.documentElement.cloneNode(true);
  // styles injected through CSSOM (styled-components, emotion ...)
  const live = document.querySelectorAll('style'), cl = clone.querySelectorAll('style');
  live.forEach((s, i) => {
    try {
      if (!s.textContent.trim() && s.sheet && cl[i]) {
        cl[i].textContent = Array.from(s.sheet.cssRules).map((r) => r.cssText).join('\n');
      }
    } catch (e) {}
  });
  try {
    (document.adoptedStyleSheets || []).forEach((sh) => {
      const st = document.createElement('style');
      st.textContent = Array.from(sh.cssRules).map((r) => r.cssText).join('\n');
      const head = clone.querySelector('head');
      if (head) head.appendChild(st);
    });
  } catch (e) {}
  clone.querySelectorAll('img').forEach((img) => {
    const ds = img.getAttribute('data-src') || img.getAttribute('data-original');
    const cur = img.getAttribute('src');
    if (ds && (!cur || cur.startsWith('data:'))) img.setAttribute('src', ds);
    const dss = img.getAttribute('data-srcset');
    if (dss && !img.getAttribute('srcset')) img.setAttribute('srcset', dss);
  });
  return {
    html: (document.doctype ? '<!DOCTYPE ' + document.doctype.name + '>' : '<!DOCTYPE html>') + '\n' + clone.outerHTML,
    base: document.baseURI,
    url: location.href,
    links: [...document.querySelectorAll('a[href]')].map((a) => a.href),
    res: performance.getEntriesByType('resource').map((e) => ({ url: e.name, type: e.initiatorType }))
  };
}

/* ---------- window control ---------- */
let winId = null, tabId = null;

async function waitComplete() {
  await sleep(700);
  for (let i = 0; i < 120; i++) {
    const t = await api.tabs.get(tabId);
    if (t.status === 'complete') return;
    await sleep(350);
  }
}
async function navigate(url) {
  await api.tabs.update(tabId, { url });
  await waitComplete();
  await sleep(1200);
}

/* ---------- page rewriting ---------- */
async function rewritePage(pg, pages) {
  const doc = new DOMParser().parseFromString(pg.html, 'text/html');
  const { base, path: from } = pg;
  doc.querySelectorAll('base').forEach((b) => b.remove());
  doc.querySelectorAll('meta[http-equiv]').forEach((m) => {
    if (/content-security-policy/i.test(m.getAttribute('http-equiv'))) m.remove();
  });
  if (!keepJs) {
    doc.querySelectorAll('script, link[rel="modulepreload"], link[rel="preload"][as="script"]').forEach((e) => e.remove());
  }

  const toAbs = (v) => {
    if (!v || /^(data:|blob:|#|javascript:|about:|mailto:|tel:)/i.test(v.trim())) return null;
    try { const a = new URL(v, base).href; return /^https?:/.test(a) ? a : null; } catch { return null; }
  };
  const local = async (v) => {
    const abs = toAbs(v);
    if (!abs) return null;
    const p = await getAsset(abs);
    return p ? rel(from, p) : null;
  };

  const tasks = [];
  for (const el of [...doc.querySelectorAll('*')]) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'a' || tag === 'area' || tag === 'iframe' || tag === 'form') continue;

    if (tag === 'script' && el.hasAttribute('src')) {
      const abs = toAbs(el.getAttribute('src'));
      if (abs && skipHost.test(new URL(abs).hostname)) { el.remove(); continue; }
    }
    for (const attr of ['src', 'poster', 'data-src', 'data-original']) {
      if (el.hasAttribute(attr)) {
        tasks.push(local(el.getAttribute(attr)).then((r) => {
          if (r) { el.setAttribute(attr, r); el.removeAttribute('integrity'); el.removeAttribute('crossorigin'); }
        }));
      }
    }
    if (tag === 'link' && el.hasAttribute('href')) {
      const relv = (el.getAttribute('rel') || '').toLowerCase();
      const as = (el.getAttribute('as') || '').toLowerCase();
      if (/stylesheet|icon|preload|modulepreload|apple-touch/.test(relv) && as !== 'fetch') {
        tasks.push(local(el.getAttribute('href')).then((r) => {
          if (r) { el.setAttribute('href', r); el.removeAttribute('integrity'); el.removeAttribute('crossorigin'); }
        }));
      }
    }
    if (el.hasAttribute('srcset')) {
      const parts = el.getAttribute('srcset').split(',').map((s) => s.trim()).filter(Boolean);
      tasks.push(Promise.all(parts.map(async (part) => {
        const [u, ...d] = part.split(/\s+/);
        const r = await local(u);
        return (r || toAbs(u) || u) + (d.length ? ' ' + d.join(' ') : '');
      })).then((out) => el.setAttribute('srcset', out.join(', '))));
    }
    if (el.hasAttribute('style') && /url\(/i.test(el.getAttribute('style'))) {
      tasks.push(processCss(el.getAttribute('style'), base, from).then((t) => el.setAttribute('style', t)));
    }
  }
  for (const st of doc.querySelectorAll('style')) {
    tasks.push(processCss(st.textContent, base, from).then((t) => { st.textContent = t; }));
  }
  await Promise.all(tasks);

  // links between pages
  for (const a of doc.querySelectorAll('a[href], area[href]')) {
    const abs = toAbs(a.getAttribute('href'));
    if (!abs) continue;
    const u = new URL(abs);
    const target = pages.get(norm(abs));
    a.setAttribute('href', target ? rel(from, target.path) + u.hash : abs);
  }

  const dt = doc.doctype ? new XMLSerializer().serializeToString(doc.doctype) : '<!DOCTYPE html>';
  return dt + '\n' + doc.documentElement.outerHTML;
}

/* ---------- main ---------- */
async function unregisterRT() {
  try {
    if (api.scripting && api.scripting.unregisterContentScripts) {
      await api.scripting.unregisterContentScripts({ ids: ['rt'] });
    }
  } catch {}
}

async function main() {
  await unregisterRT();
  await api.scripting.registerContentScripts([{
    id: 'rt', matches: ['<all_urls>'], js: ['early.js'],
    runAt: 'document_start', world: 'MAIN', persistAcrossSessions: false
  }]);

  // the capture window covers only the right side so this page stays visible (hidden windows get throttled timers)
  const aw = screen.availWidth || 1280, ah = screen.availHeight || 800;
  const al = screen.availLeft || 0, at = screen.availTop || 0;
  log('Opening capture window...');
  const w = await api.windows.create({
    url: startUrl, type: 'popup', focused: true,
    left: Math.round(al + aw * 0.4), top: at, width: Math.round(aw * 0.6), height: ah
  });
  winId = w.id;
  tabId = (w.tabs && w.tabs[0] && w.tabs[0].id) || (await api.tabs.query({ windowId: w.id }))[0]?.id;
  log('Waiting for the page to load...');
  await waitComplete();
  await sleep(1200);
  log('Loaded, starting capture');

  const pages = new Map();
  const seen = new Set();
  const queue = [[norm(startUrl), 0]];
  let first = true;

  try {
    // Phase 1: capture live pages
    while (queue.length && pages.size < maxPages) {
      const [url, depth] = queue.shift();
      if (seen.has(url)) continue;
      seen.add(url);
      statusEl.textContent = `Capturing pages... (${pages.size + 1})`;
      try {
        if (!first) await navigate(url);
        first = false;
        log('Scrolling and capturing: ' + url);
        const res = await withTimeout(
          api.scripting.executeScript({ target: { tabId }, func: captureInPage, world: 'MAIN' }),
          90000, 'Capture timed out (90 seconds)');
        const result = res && res[0] && res[0].result;
        if (!result) { log('✗ Could not capture: ' + url); continue; }
        const finalUrl = norm(result.url);
        if (new URL(finalUrl).origin !== ORIGIN || pages.has(finalUrl)) { log('Skipped: ' + finalUrl); continue; }
        let path = pagePath(finalUrl);
        if (usedPaths.has(path)) path = path.replace(/\.html$/, '_' + hash(finalUrl) + '.html');
        usedPaths.set(path, finalUrl);
        pages.set(finalUrl, { ...result, path });
        log('📄 ' + finalUrl + ' → ' + path + ` (${result.res.length} files)`);

        if (depth < maxDepth) {
          for (const h of result.links) {
            try {
              const a = new URL(h);
              if (!/^https?:$/.test(a.protocol) || a.origin !== ORIGIN || skipExt.test(a.pathname)) continue;
              queue.push([norm(a.href), depth + 1]);
            } catch {}
          }
        }
      } catch (e) { log('✗ Failed: ' + url + ' — ' + e.message); }
    }
  } finally {
    try { if (winId) await api.windows.remove(winId); } catch {}
    await unregisterRT();
  }

  // Phase 2: download every file the browser actually loaded
  statusEl.textContent = 'Downloading CSS, JS, images and fonts...';
  const skipTypes = /^(fetch|xmlhttprequest|beacon|iframe|frame|ping)$/;
  for (const pg of pages.values()) {
    await Promise.all(pg.res.filter((r) => /^https?:/.test(r.url) && !skipTypes.test(r.type)).map((r) => getAsset(r.url)));
  }

  // Phase 3: rewrite links
  statusEl.textContent = 'Rewriting links...';
  for (const pg of pages.values()) files.set(pg.path, await rewritePage(pg, pages));

  const entry = pages.get(norm(startUrl)) || [...pages.values()][0];
  if (entry && entry.path !== 'index.html' && !files.has('index.html')) {
    files.set('index.html', `<!DOCTYPE html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${entry.path}"><a href="${entry.path}">${entry.path}</a>`);
  }
  files.set('start-server.bat', '@echo off\r\nstart http://localhost:8000\r\npython -m http.server 8000\r\n');
  files.set('_report.txt', `Site: ${startUrl}\r\nPages: ${pages.size}\r\nFiles that failed to download: ${failed.length}\r\n\r\n` + failed.join('\r\n'));

  window.__result = { files, failed, pages };

  // Phase 4: ZIP
  statusEl.textContent = 'Creating ZIP file...';
  const zip = new JSZip();
  files.forEach((content, path) => zip.file(path, content));
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = new URL(startUrl).hostname + '.zip';
  a.click();
  statusEl.textContent = `Done ✅ (${pages.size} pages, ${files.size} files, ${failed.length} failed)`;
}

main().catch(async (e) => {
  statusEl.textContent = 'An error occurred';
  log(String(e && e.stack || e));
  try { if (winId) await api.windows.remove(winId); } catch {}
  await unregisterRT();
});
