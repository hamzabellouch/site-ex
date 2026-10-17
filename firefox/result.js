(async () => {
  const api = globalThis.browser || globalThis.chrome;
  const { lastPick: b } = await api.storage.local.get('lastPick');
  if (!b) { document.body.textContent = 'No data found. Pick an element from a page first.'; return; }
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  $('t-html').value = b.html;
  $('t-css').value = b.css;
  $('t-js').value = b.js;

  const hasAcc = !!(b.accurate && b.accurate.html);

  /* ---------- documents ---------- */
  const accurateDoc = (withBase) => `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n${withBase ? `<base href="${esc(b.url)}">\n` : ''}<style>\n${b.accurate.fontCss}\nbody { margin: 0; }\n</style>\n</head>\n<body>\n${b.accurate.html}\n</body>\n</html>\n`;

  /* ---------- preview ---------- */
  const run = b.run || { external: b.extScripts || [], inline: [] };
  const baseItems = (run.items && run.items.length) ? run.items.slice()
    : [...run.external.map((src, k) => ({ i: k, src })), ...run.inline.map((text, k) => ({ i: 1000 + k, text }))];
  const allScripts = b.allScripts || [];
  const resolved = new Map();   // scripts added automatically to satisfy "X is not defined"
  // scripts found by dependency resolution run FIRST (newest first, since each one may need the previous);
  // the rest keep the page's original order
  const currentItems = () => [...[...resolved.values()].reverse(), ...baseItems.slice().sort((x, y) => x.i - y.i)]
    .filter((x, idx, arr) => arr.findIndex((y) => y.i === x.i) === idx);
  const scriptCache = new Map();
  const loadScript = async (u) => {
    if (scriptCache.has(u)) return scriptCache.get(u);
    let t = null;
    try { const r = await fetch(u, { credentials: 'include' }); if (r.ok) t = await r.text(); } catch {}
    scriptCache.set(u, t);
    return t;
  };
  const itemText = (it) => (it.src ? loadScript(it.src) : Promise.resolve(it.text));
  const safeScript = (t) => String(t).replace(/<\/script/gi, '<\\/script');
  const errorHook = `<script>(function(){var s=function(m){try{parent.postMessage({type:'preview-error',msg:String(m).slice(0,300)},'*')}catch(e){}};window.addEventListener('error',function(e){s((e.message||'error')+(e.filename?' ('+e.filename.split('/').pop()+':'+e.lineno+')':''));e.preventDefault()});window.addEventListener('unhandledrejection',function(e){s('Unhandled promise: '+((e.reason&&e.reason.message)||e.reason));e.preventDefault()});var ce=console.error;console.error=function(){s([].slice.call(arguments).join(' '));ce.apply(console,arguments)};})();<\/script>`;
  let refErrors = [];
  const addErr = (msg) => {
    const box = $('pconsole');
    box.hidden = false;
    box.textContent += (box.textContent ? '\n' : '') + '• ' + msg;
    const m = /ReferenceError: ([\w$]+) is not defined/.exec(msg);
    if (m) refErrors.push(m[1]);
  };
  async function liveDoc(withJs) {
    let status = '';
    let tags = '';
    if (withJs) {
      const items = currentItems();
      const texts = await Promise.all(items.map(itemText));
      let ok = 0;
      items.forEach((it, k) => {
        if (texts[k] == null) return;
        ok++;
        tags += `<script${it.mod ? ' type="module"' : ''}>\n${safeScript(texts[k])}\n<\/script>\n`;
      });
      status = `Scripts executed: ${ok} of ${items.length} script(s)` +
        (resolved.size ? `, including ${resolved.size} added automatically to satisfy missing dependencies` : '') + '.';
    } else status = 'JavaScript is off in this view (HTML + CSS only).';
    const doc = `<!DOCTYPE html>\n<html ${b.htmlAttrs || ''}>\n<head>\n<meta charset="utf-8">\n<base href="${esc(b.url)}">\n${errorHook}\n<style>\n${b.css}\n</style>\n</head>\n<body ${b.bodyAttrs || ''}>\n${b.wrapOpen || ''}\n${b.html}\n${b.wrapClose || ''}\n${tags}\n</body>\n</html>\n`;
    return { doc, status };
  }

  /* find a page script that defines a missing global (ReferenceError: X is not defined) */
  const escRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const definesName = (text, n) => new RegExp(
    `\\b(?:var|let|const|function)\\s+${escRe(n)}\\b|(?:window|self|globalThis|this)\\s*(?:\\.|\\[\\s*["'])${escRe(n)}["']?\\s*\\]?\\s*=[^=]|(?:^|[;,{(\\s])${escRe(n)}\\s*=[^=>]`
  ).test(text);
  let prefetched = false;
  async function findDefiner(name) {
    const inUse = new Set(currentItems().map((x) => x.i));
    const cands = allScripts.filter((x) => !inUse.has(x.i));
    if (!prefetched) {
      prefetched = true;
      await Promise.all(cands.filter((x) => x.src).slice(0, 80).map((x) => loadScript(x.src)));
    }
    for (const it of cands) {
      const t = it.src ? scriptCache.get(it.src) : it.text;
      if (t && definesName(t, name)) return it;
    }
    return null;
  }
  async function resolveDeps(my, round) {
    await new Promise((r) => setTimeout(r, 2500));   // let the scripts run, then look at the errors
    if (my !== seq) return;
    const names = [...new Set(refErrors)];
    if (!names.length) return;
    if (round >= 5) { $('pstatus').textContent += ' Some dependencies are still missing.'; return; }
    const added = [], missing = [];
    for (const n of names) {
      const it = await findDefiner(n);
      if (my !== seq) return;
      if (it) { resolved.set(it.i, it); added.push(n); } else missing.push(n);
    }
    if (added.length) { await setMode('live', round + 1); return; }
    $('pstatus').textContent += ` No page script was found that defines: ${missing.join(', ')}.`;
  }

  let seq = 0;
  async function setMode(m, round = 0) {
    const my = ++seq;
    refErrors = [];
    ['live', 'ext', 'acc'].forEach((k) => $('m-' + k).classList.toggle('on', k === m));
    $('pstatus').textContent = round ? `Resolving dependencies (round ${round})…` : 'Loading…';
    $('pconsole').hidden = true;
    $('pconsole').textContent = '';
    let doc, status;
    if (m === 'acc') { doc = accurateDoc(true); status = 'Static snapshot of the computed styles (no JavaScript).'; }
    else ({ doc, status } = await liveDoc(m === 'live'));
    if (my !== seq) return;
    window.__previewDoc = doc;
    const f = document.createElement('iframe');
    f.id = 'frame';
    f.src = 'preview.html';
    $('frame').replaceWith(f);
    f.addEventListener('load', () => f.contentWindow.postMessage({ type: 'render', doc }, '*'));
    $('pstatus').textContent = status;
    if (m === 'live') resolveDeps(my, round);
  }
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'preview-error' && e.source === $('frame').contentWindow) addErr(e.data.msg);
  });
  $('m-acc').disabled = !hasAcc;
  $('zipacc').disabled = !hasAcc;
  $('m-live').addEventListener('click', () => setMode('live'));
  $('m-ext').addEventListener('click', () => setMode('ext'));
  $('m-acc').addEventListener('click', () => setMode('acc'));
  setMode('live');

  /* ---------- expanded preview (centered overlay with blurred background) ---------- */
  const stage = $('stage'), backdrop = $('backdrop'), expandBtn = $('expand');
  const setExpanded = (on) => {
    stage.classList.toggle('expanded', on);
    backdrop.classList.toggle('on', on);
    document.body.style.overflow = on ? 'hidden' : '';
    expandBtn.setAttribute('aria-label', on ? 'Close' : 'Expand preview');
    expandBtn.title = on ? 'Close' : 'Expand preview';
  };
  expandBtn.addEventListener('click', () => setExpanded(!stage.classList.contains('expanded')));
  backdrop.addEventListener('click', () => setExpanded(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stage.classList.contains('expanded')) setExpanded(false); });

  let cur = 'html';
  document.querySelectorAll('.tabs button[data-t]').forEach((btn) => btn.addEventListener('click', () => {
    cur = btn.dataset.t;
    if (cur !== 'prev') setExpanded(false);
    document.querySelectorAll('.tabs button[data-t]').forEach((x) => x.classList.toggle('on', x === btn));
    document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.id === 'p-' + cur));
    $('copy').style.display = cur === 'prev' ? 'none' : '';
  }));
  $('copy').addEventListener('click', async () => {
    await navigator.clipboard.writeText($('t-' + cur).value);
    $('copy').textContent = 'Copied ✓';
    setTimeout(() => { $('copy').textContent = 'Copy'; }, 1500);
  });

  /* ---------- assets ---------- */
  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36).slice(0, 6); };
  const MAX_ASSET = 25 * 1024 * 1024;

  function scanCss(text, add) {
    for (const m of text.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)) add(m[2]);
    for (const m of text.matchAll(/@import\s+(['"])(.*?)\1/g)) add(m[2]);
  }
  function scanHtml(html, add) {
    const doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
    doc.querySelectorAll('[src], [poster], [data-src], [data-original]').forEach((el) => {
      if (/^(script|iframe)$/i.test(el.tagName)) return;
      for (const a of ['src', 'poster', 'data-src', 'data-original']) add(el.getAttribute(a));
    });
    doc.querySelectorAll('[srcset]').forEach((el) => el.getAttribute('srcset').split(',').forEach((p) => add(p.trim().split(/\s+/)[0])));
    doc.querySelectorAll('image, use').forEach((el) => add(el.getAttribute('href') || el.getAttribute('xlink:href')));
    doc.querySelectorAll('[style]').forEach((el) => scanCss(el.getAttribute('style'), add));
    doc.querySelectorAll('style').forEach((el) => scanCss(el.textContent, add));
  }
  function kindOf(url, ct) {
    if (/image\//i.test(ct) || /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp)(\?|#|$)/i.test(url)) return 'img';
    if (/font|woff|ttf|otf|eot/i.test(ct) || /\.(woff2?|ttf|otf|eot)(\?|#|$)/i.test(url)) return 'fonts';
    if (/javascript/i.test(ct) || /\.m?js(\?|#|$)/i.test(url)) return 'js';
    return 'other';
  }
  function extOf(ct) {
    ct = (ct || '').toLowerCase();
    if (ct.includes('svg')) return '.svg';
    if (ct.includes('woff2')) return '.woff2';
    if (ct.includes('woff')) return '.woff';
    if (ct.includes('javascript')) return '.js';
    if (ct.includes('x-icon') || ct.includes('vnd.microsoft.icon')) return '.ico';
    const m = ct.match(/image\/(png|jpeg|gif|webp|avif|bmp)/);
    return m ? '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]) : '';
  }
  async function gatherAssets(htmlList, cssList, extraUrls, onProgress) {
    const urls = new Set();
    const add = (u) => { if (u && /^https?:/i.test(u.trim())) urls.add(u.trim()); };
    htmlList.forEach((h) => scanHtml(h, add));
    cssList.forEach((c) => scanCss(c, add));
    extraUrls.forEach(add);
    const list = [...urls];
    const map = new Map(), files = new Map(), failed = [], usedNames = new Set();
    let done = 0;
    const queue = list.slice();
    const one = async (url) => {
      try {
        const r = await fetch(url, { credentials: 'include' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        if ((+r.headers.get('content-length') || 0) > MAX_ASSET) throw new Error('file too large');
        const ct = r.headers.get('content-type') || '';
        const buf = await r.arrayBuffer();
        if (buf.byteLength > MAX_ASSET) throw new Error('file too large');
        const kind = kindOf(url, ct);
        let seg = 'file';
        try { seg = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'file'); } catch {}
        seg = seg.replace(/[^\w.\-]/g, '_').slice(-60) || 'file';
        const m = seg.match(/^(.*?)(\.[A-Za-z0-9]{1,6})?$/);
        const name = m[1] + '_' + hash(url) + (m[2] || extOf(ct));
        let path = `assets/${kind}/${name}`;
        while (usedNames.has(path)) path = path.replace(/(\.[^./]*)?$/, (x) => '_x' + x);
        usedNames.add(path);
        map.set(url, path);
        files.set(path, buf);
      } catch (e) {
        failed.push(url + ' — ' + e.message);
      }
      done++;
      onProgress(done, list.length);
    };
    await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await one(queue.shift()); }));
    return { map, files, failed, total: list.length };
  }
  function applyMap(text, map, isHtml) {
    const keys = [...map.keys()].sort((a, c) => c.length - a.length);
    for (const k of keys) {
      const v = map.get(k);
      text = text.split(k).join(v);
      if (isHtml && k.includes('&')) text = text.split(k.replace(/&/g, '&amp;')).join(v);
    }
    return text;
  }

  const save = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
  };
  async function exportZip(btn, kind) {
    const label = btn.textContent;
    btn.disabled = true;
    try {
      const code = kind === 'code';
      const items = code ? currentItems() : [];
      const scripts = items.filter((x) => x.src).map((x) => x.src);
      const assets = await gatherAssets(
        code ? [b.html, b.wrapOpen || '', b.wrapClose || ''] : [b.accurate.html],
        code ? [b.css] : [b.accurate.fontCss],
        scripts,
        (d, t) => { btn.textContent = `Downloading assets… ${d}/${t}`; }
      );
      const zip = new JSZip();
      if (code) {
        const tags = items.filter((x) => x.src).map((x) => `<script${x.mod ? ' type="module"' : ''} src="${x.src}"></script>`).join('\n');
        const index = `<!DOCTYPE html>\n<html ${b.htmlAttrs || ''}>\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${(b.title || 'element').replace(/</g, '&lt;')}</title>\n<link rel="stylesheet" href="style.css">\n</head>\n<body ${b.bodyAttrs || ''}>\n${b.wrapOpen || ''}\n${b.html}\n${b.wrapClose || ''}\n${tags}\n<script src="script.js"></script>\n</body>\n</html>\n`;
        zip.file('index.html', applyMap(index, assets.map, true));
        zip.file('style.css', applyMap(b.css, assets.map, false));
        zip.file('script.js', items.filter((x) => x.text).map((x) => x.text).join('\n;\n') || b.js);
        zip.file('js-report.txt', b.js);
      } else {
        zip.file('index.html', applyMap(accurateDoc(false), assets.map, true));
      }
      assets.files.forEach((buf, path) => zip.file(path, buf));
      zip.file('_report.txt', `Source: ${b.url}\nElement: ${b.selector}\nAssets found: ${assets.total}\nDownloaded: ${assets.files.size}\nFailed: ${assets.failed.length}\n\n${assets.failed.join('\n')}\n`);
      btn.textContent = 'Creating ZIP…';
      save(await zip.generateAsync({ type: 'blob' }), code ? 'element.zip' : 'element-accurate.zip');
      btn.textContent = assets.failed.length ? `Done (${assets.failed.length} asset(s) failed, see _report.txt)` : 'Done ✓';
    } catch (e) {
      btn.textContent = 'Failed: ' + (e && e.message || e);
    }
    setTimeout(() => { btn.textContent = label; btn.disabled = kind === 'acc' && !hasAcc; }, 3500);
  }
  $('zip').addEventListener('click', () => exportZip($('zip'), 'code'));
  $('zipacc').addEventListener('click', () => exportZip($('zipacc'), 'acc'));

  /* ---------- notes ---------- */
  const n = b.notes || {};
  const lines = ['Both ZIP downloads include the images, fonts, background images and scripts used by the element in an <code>assets</code> folder, with all links rewritten to local paths. Anything that could not be downloaded is listed in <code>_report.txt</code>.'];
  lines.push('<b>Live preview:</b> runs the JavaScript that belongs to or references this element (scripts inside it, inline page scripts and external files that mention it) in an isolated sandbox, together with the extracted HTML and CSS, so hover effects, transitions and script-driven behavior can work. Behavior that depends on other parts of the original site\'s code may still differ. Errors from the scripts appear under the preview. If a script reports a missing global (for example "X is not defined"), the preview searches the page\'s other scripts for one that defines it and re-runs automatically, up to 5 rounds. The code ZIP loads the same scripts: script.js plus the downloaded files.');
  if (hasAcc) lines.push(`<b>Pixel-accurate snapshot:</b> ${b.accurate.count} elements with computed styles inlined. It matches the on-screen look at the current window size, but sizes are fixed (not responsive) and animations and hover effects are not included.`);
  else if (b.accurate && b.accurate.error) lines.push('Pixel-accurate snapshot unavailable: ' + b.accurate.error);
  if (b.shadowCount) lines.push(`This element contains ${b.shadowCount} web component(s) using Shadow DOM. Their inner content is not in the HTML and CSS tabs; use the pixel-accurate snapshot to see it.`);
  if (n.fetchedViaProxy && n.fetchedViaProxy.length) lines.push(`Analyzed ${n.fetchedViaProxy.length} external CSS file(s) (from other domains) to extract the element's rules.`);
  if (n.failedSheets && n.failedSheets.length) lines.push('These stylesheets could not be read, so some styles may be missing:<br>' + n.failedSheets.map((u) => '• ' + u).join('<br>'));
  lines.push('The extracted CSS may rely on styles inherited from parent elements (such as font and color), so compare the preview modes.');
  $('notes').innerHTML = lines.join('<br>');

  /* Info capsule: show / hide the notes on demand */
  const info = $('info'), notesEl = $('notes');
  const closeInfo = () => { notesEl.hidden = true; info.classList.remove('on'); };
  info.addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = notesEl.hidden;
    notesEl.hidden = !opening;
    info.classList.toggle('on', opening);
  });
  document.addEventListener('click', (e) => { if (!notesEl.hidden && !notesEl.contains(e.target)) closeInfo(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeInfo(); });
})();
