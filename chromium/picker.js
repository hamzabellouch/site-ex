(() => {
  if (window.__sePickerActive) return;

  /* ================= extraction ================= */
  const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
  const PSEUDO = /::?(hover|focus-visible|focus-within|focus|active|visited|any-link|link|target|before|after|first-line|first-letter|selection|placeholder|marker|backdrop|file-selector-button|cue|-webkit-[\w-]+(\([^)]*\))?|-moz-[\w-]+(\([^)]*\))?|-ms-[\w-]+)/gi;
  const SKIP_HOST = /(google-analytics|googletagmanager|doubleclick|googlesyndication|facebook\.net|hotjar|clarity\.ms|segment\.(io|com)|sentry)/i;

  const absUrl = (v, base) => { try { return new URL(v, base).href; } catch { return v; } };
  function absCss(text, base) {
    return text
      .replace(/url\(\s*(['"]?)(.*?)\1\s*\)/g, (m, q, u) => {
        if (!u || /^(data:|#|blob:)/i.test(u.trim())) return m;
        return 'url("' + absUrl(u, base) + '")';
      })
      .replace(/@import\s+(['"])(.*?)\1/g, (m, q, u) => '@import "' + absUrl(u, base) + '"');
  }
  function splitTop(sel) {
    const out = []; let d = 0, cur = '';
    for (const ch of sel) {
      if (ch === '(' || ch === '[') d++;
      if (ch === ')' || ch === ']') d--;
      if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out;
  }
  function pretty(css) {
    let out = '', ind = 0, paren = 0, q = null;
    for (let i = 0; i < css.length; i++) {
      const ch = css[i];
      if (q) { out += ch; if (ch === '\\') out += css[++i] || ''; else if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'") { q = ch; out += ch; continue; }
      if (ch === '(') paren++; else if (ch === ')') paren = Math.max(0, paren - 1);
      if (paren > 0) { out += ch; continue; }
      if (ch === '{') { ind++; out = out.replace(/\s+$/, '') + ' {\n' + '  '.repeat(ind); }
      else if (ch === '}') { ind = Math.max(0, ind - 1); out = out.replace(/\s+$/, '') + '\n' + '  '.repeat(ind) + '}' + (ind === 0 ? '\n\n' : '\n' + '  '.repeat(ind)); }
      else if (ch === ';') out += ';\n' + '  '.repeat(ind);
      else if (/\s/.test(ch)) { if (!/\s$/.test(out)) out += ' '; }
      else { out += ch; if (ch === '/' && out.slice(-2) === '*/') out += '\n' + '  '.repeat(ind); }
    }
    return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }
  function fmt(node, ind) {
    const pad = '  '.repeat(ind);
    if (node.nodeType === 3) {
      const t = node.textContent.replace(/\s+/g, ' ').trim();
      return t ? pad + t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '\n' : '';
    }
    if (node.nodeType === 8) return pad + '<!--' + node.textContent + '-->\n';
    if (node.nodeType !== 1) return '';
    const tag = node.tagName.toLowerCase();
    const shallow = node.cloneNode(false).outerHTML;
    if (VOID.has(tag)) return pad + shallow + '\n';
    if (/^(pre|textarea|style|script)$/.test(tag) || !node.childNodes.length) return pad + node.outerHTML + '\n';
    const close = '</' + tag + '>';
    const open = shallow.slice(0, shallow.length - close.length);
    let s = pad + open + '\n';
    node.childNodes.forEach((c) => { s += fmt(c, ind + 1); });
    return s + pad + close + '\n';
  }
  function describe(el) {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.classList && el.classList.length) s += '.' + [...el.classList].slice(0, 3).join('.');
    return s;
  }
  function pathOf(el) {
    const parts = [];
    for (let e = el, i = 0; e && e.nodeType === 1 && i < 4; e = e.parentElement, i++) parts.unshift(describe(e));
    return parts.join(' > ');
  }
  async function fetchText(url) {
    try {
      const r = await chrome.runtime.sendMessage({ type: 'fetchText', url });
      return r && r.ok ? r.text : null;
    } catch { return null; }
  }


  /* ---- pixel-accurate snapshot: inline computed styles, flatten open shadow roots ---- */
  function buildAccurate(root, fontRules) {
    const MAX = 2500;
    const base = document.baseURI;
    const XHTML = 'http://www.w3.org/1999/xhtml';
    const fams = new Set();
    let count = 0;
    const idoc = document.implementation.createHTMLDocument('');   // inert document: no custom-element upgrades
    const ifr = document.createElement('iframe');
    ifr.style.cssText = 'position:fixed;left:-9999px;top:0;width:0;height:0;border:0;visibility:hidden';
    document.documentElement.appendChild(ifr);
    try {
      const bdoc = ifr.contentDocument, bwin = ifr.contentWindow;
      bdoc.open(); bdoc.write('<!DOCTYPE html><html><body></body></html>'); bdoc.close();
      const baseCache = new Map();
      const baseline = (el) => {
        const key = el.namespaceURI + ' ' + el.localName;
        let cs = baseCache.get(key);
        if (!cs) {
          const be = el.namespaceURI === XHTML ? bdoc.createElement(el.localName) : bdoc.createElementNS(el.namespaceURI, el.localName);
          bdoc.body.appendChild(be);
          cs = bwin.getComputedStyle(be);
          baseCache.set(key, cs);
        }
        return cs;
      };
      const SKIP = /^(transition|animation|view-timeline|scroll-timeline|timeline-scope|-webkit-locale)|(^|-)(inline|block)(-|$)/;
      const diff = (cs, bs) => {
        let out = '';
        for (let i = 0; i < cs.length; i++) {
          const p = cs[i];
          if (p === 'content' || SKIP.test(p)) continue;
          const v = cs.getPropertyValue(p);
          if (v !== bs.getPropertyValue(p)) out += p + ':' + v + ';';
        }
        return out;
      };
      const addFams = (cs) => (cs.fontFamily || '').split(',').forEach((f) => fams.add(f.trim().replace(/^["']|["']$/g, '').toLowerCase()));
      const URLATTR = ['src', 'href', 'poster', 'data-src', 'action'];
      const copyAttrs = (src, out) => {
        for (const at of src.attributes) {
          const n = at.name;
          if (/^on/i.test(n) || n === 'style' || n === 'srcset' || n === 'sizes' || n === 'loading') continue;
          let v = at.value;
          if (URLATTR.includes(n) && v && !/^(data:|blob:|#|javascript:|mailto:|tel:)/i.test(v.trim())) v = absUrl(v, base);
          try { out.setAttribute(n, v); } catch {}
        }
      };
      const pseudoSpan = (src, which) => {
        let pcs;
        try { pcs = getComputedStyle(src, which); } catch { return null; }
        const c = pcs.content;
        if (!c || c === 'none' || c === 'normal') return null;
        const m = c.match(/^"([\s\S]*)"$/);
        if (!m) return null;
        const span = idoc.createElement('span');
        span.setAttribute('data-pseudo', which.replace('::', ''));
        span.textContent = m[1].replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\(.)/g, '$1');
        addFams(pcs);
        const st = diff(pcs, baseline(span));
        if (st) span.setAttribute('style', st);
        return span;
      };
      function build(src, isRoot) {
        if (src.nodeType === 3) return idoc.createTextNode(src.textContent);
        if (src.nodeType !== 1) return null;
        const tag = src.localName;
        if (/^(script|noscript|style|link|template|meta|head|title|base)$/.test(tag)) return null;
        if (++count > MAX) throw new Error('more than ' + MAX + ' elements');
        let cs;
        try { cs = getComputedStyle(src); } catch { return null; }
        if (cs.display === 'none') return null;
        addFams(cs);
        let out;
        if (tag === 'canvas') {
          out = idoc.createElement('img');
          try { out.setAttribute('src', src.toDataURL()); } catch {}
        } else {
          out = src.namespaceURI === XHTML ? idoc.createElement(tag) : idoc.createElementNS(src.namespaceURI, tag);
          copyAttrs(src, out);
          if (tag === 'img') { const u = src.currentSrc || src.src; if (u) out.setAttribute('src', u); }
          if (tag === 'input') out.setAttribute('value', src.value || '');
        }
        let st = diff(cs, baseline(src));
        if (isRoot && /^(absolute|fixed|sticky)$/.test(cs.position)) st += 'position:relative;top:auto;left:auto;right:auto;bottom:auto;';
        if (st) out.setAttribute('style', st);
        if (tag === 'textarea') { out.textContent = src.value || ''; return out; }
        const before = pseudoSpan(src, '::before');
        if (before) out.appendChild(before);
        let kids;
        if (tag === 'slot') {
          const assigned = src.assignedNodes ? src.assignedNodes({ flatten: true }) : [];
          kids = assigned.length ? assigned : [...src.childNodes];
        } else kids = src.shadowRoot ? [...src.shadowRoot.childNodes] : [...src.childNodes];
        for (const k of kids) { const c = build(k, false); if (c) out.appendChild(c); }
        const after = pseudoSpan(src, '::after');
        if (after) out.appendChild(after);
        return out;
      }
      const built = build(root, true);
      if (!built) return { error: 'The element is not rendered (display: none)' };
      return {
        html: built.outerHTML,
        fontCss: fontRules.filter((f) => fams.has(f.fam)).map((f) => f.text).join('\n'),
        count
      };
    } catch (e) {
      return { error: String((e && e.message) || e) };
    } finally {
      ifr.remove();
    }
  }

  async function extract(root) {
    const base = document.baseURI;
    const nodes = [root, ...root.querySelectorAll('*')];

    /* ---- HTML ---- */
    const clone = root.cloneNode(true);
    const inlineScripts = [], extScripts = [];
    clone.querySelectorAll('script').forEach((s) => {
      if (s.getAttribute('src')) extScripts.push(absUrl(s.getAttribute('src'), base));
      else if (s.textContent.trim()) inlineScripts.push(s.textContent);
      s.remove();
    });
    const handlers = [], handlerCodes = [];
    [clone, ...clone.querySelectorAll('*')].forEach((el) => {
      for (const a of ['src', 'href', 'poster', 'data-src', 'data-original', 'action']) {
        const v = el.getAttribute(a);
        if (v && !/^(data:|blob:|#|javascript:|mailto:|tel:)/i.test(v.trim())) el.setAttribute(a, absUrl(v, base));
      }
      const ss = el.getAttribute('srcset');
      if (ss) el.setAttribute('srcset', ss.split(',').map((p) => {
        const [u, ...d] = p.trim().split(/\s+/);
        return absUrl(u, base) + (d.length ? ' ' + d.join(' ') : '');
      }).join(', '));
      const st = el.getAttribute('style');
      if (st && /url\(/i.test(st)) el.setAttribute('style', absCss(st, base));
      for (const at of [...el.attributes]) if (/^on/i.test(at.name)) { handlers.push(`<${describe(el)}> ${at.name}="${at.value}"`); handlerCodes.push(at.value); }
    });
    const html = clone.outerHTML.length < 1500000 ? fmt(clone, 0).trim() : clone.outerHTML;

    /* ---- CSS ---- */
    const fams = new Set(), anims = new Set();
    for (const el of nodes.slice(0, 800)) {
      const cs = getComputedStyle(el);
      (cs.fontFamily || '').split(',').forEach((f) => fams.add(f.trim().replace(/^["']|["']$/g, '').toLowerCase()));
      (cs.animationName || '').split(',').forEach((n) => { n = n.trim(); if (n && n !== 'none') anims.add(n); });
    }
    const rootEls = [document.documentElement, document.body].filter(Boolean);
    const seen = new Set();
    const fontRules = [], kfRules = [], blocked = [], fetchedViaProxy = [], failedSheets = [];

    function ruleMatch(selText) {
      let res = 0;
      for (const part of splitTop(selText)) {
        let s = part.replace(PSEUDO, '').trim();
        if (!s) continue;
        if (/[>+~]$/.test(s)) s += ' *';
        try {
          if (rootEls.some((e) => e.matches(s))) return 2;
          if (root.matches(s) || root.querySelector(s)) res = 1;
        } catch {}
      }
      return res;
    }
    function collect(rules, sheetBase) {
      const out = { root: [], sub: [] };
      for (const rule of rules) {
        if (rule.type === 1) {
          const m = ruleMatch(rule.selectorText || '');
          if (m) {
            const txt = absCss(rule.cssText, sheetBase);
            if (!seen.has(txt)) { seen.add(txt); (m === 2 ? out.root : out.sub).push(txt); }
          }
        } else if (rule.type === 3) {
          let sub = null;
          try { sub = rule.styleSheet && rule.styleSheet.cssRules; } catch {}
          if (sub) {
            const r = collect(sub, (rule.styleSheet && rule.styleSheet.href) || sheetBase);
            out.root.push(...r.root); out.sub.push(...r.sub);
          } else if (rule.href) blocked.push(absUrl(rule.href, sheetBase));
        } else if (rule.type === 5) {
          const fam = (rule.style.getPropertyValue('font-family') || '').replace(/^["']|["']$/g, '').toLowerCase();
          fontRules.push({ fam, text: absCss(rule.cssText, sheetBase) });
        } else if (rule.type === 7) {
          kfRules.push({ name: rule.name, text: absCss(rule.cssText, sheetBase) });
        } else if (rule.cssRules && rule.cssRules.length) {
          const r = collect(rule.cssRules, sheetBase);
          const head = rule.cssText.slice(0, rule.cssText.indexOf('{')).trim();
          if (r.root.length) out.root.push(head + ' {\n' + r.root.join('\n') + '\n}');
          if (r.sub.length) out.sub.push(head + ' {\n' + r.sub.join('\n') + '\n}');
        }
      }
      return out;
    }
    const all = { root: [], sub: [] };
    const merge = (r) => { all.root.push(...r.root); all.sub.push(...r.sub); };
    const sheets = [...document.styleSheets];
    try { sheets.push(...(document.adoptedStyleSheets || [])); } catch {}
    for (const sh of sheets) {
      if (sh.disabled) continue;
      const media = sh.media && sh.media.mediaText;
      if (media === 'print') continue;
      const sbase = sh.href || base;
      let rules = null;
      try { rules = sh.cssRules; } catch { if (sh.href) blocked.push(sh.href); continue; }
      let r = collect(rules, sbase);
      if (media && media !== 'all') {
        r = { root: r.root.length ? [`@media ${media} {\n${r.root.join('\n')}\n}`] : [], sub: r.sub.length ? [`@media ${media} {\n${r.sub.join('\n')}\n}`] : [] };
      }
      merge(r);
    }
    // stylesheets blocked by CORS: fetched through the extension and parsed locally
    const done = new Set();
    for (const href of blocked) {
      if (done.has(href)) continue;
      done.add(href);
      const text = await fetchText(href);
      if (text == null) { failedSheets.push(href); continue; }
      // constructed stylesheets reject @import: strip them and fetch the imported files ourselves
      const clean = text.replace(/@import\s+([^;]+);/gi, (m, rest) => {
        const u = rest.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i) || rest.match(/^\s*['"]([^'"]+)['"]/);
        if (u && blocked.length < 200) blocked.push(absUrl(u[1], href));
        return '';
      });
      try {
        const cs = new CSSStyleSheet();
        cs.replaceSync(clean);
        merge(collect(cs.cssRules, href));
        fetchedViaProxy.push(href);
      } catch { failedSheets.push(href); }
    }
    // also detect used fonts and animations from the rule text itself
    const used = [...all.root, ...all.sub].join('\n');
    for (const m of used.matchAll(/font-family\s*:\s*([^;}]+)/gi)) m[1].split(',').forEach((f) => fams.add(f.trim().replace(/^["']|["']$/g, '').toLowerCase()));
    for (const m of used.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/gi)) m[1].split(/[\s,]+/).forEach((n) => { if (n) anims.add(n); });
    const fonts = fontRules.filter((f) => fams.has(f.fam)).map((f) => f.text);
    const keyframes = kfRules.filter((k) => anims.has(k.name)).map((k) => k.text);
    const cssParts = [];
    if (fonts.length) cssParts.push('/* Fonts */\n' + fonts.join('\n'));
    if (all.root.length) cssParts.push('/* Root rules (html / body / :root) */\n' + all.root.join('\n'));
    cssParts.push('/* Element rules */\n' + all.sub.join('\n'));
    if (keyframes.length) cssParts.push('/* Animations */\n' + keyframes.join('\n'));
    const css = pretty(cssParts.join('\n'));

    /* ---- JS ---- */
    const tokens = new Set();
    nodes.forEach((el) => {
      if (el.id && el.id.length >= 3) tokens.add(el.id);
      el.classList.forEach((c) => { if (c.length >= 4) tokens.add(c); });
    });
    // function names called from inline handlers (onclick="go()") are strong hints too
    const fnNames = new Set();
    handlerCodes.forEach((c) => (c.match(/[A-Za-z_$][\w$]{2,}(?=\s*\()/g) || []).forEach((n) => {
      if (!/^(function|return|if|for|while|switch|alert|confirm|prompt|this|event)$/.test(n)) fnNames.add(n);
    }));
    const tokenList = [...fnNames, ...tokens].slice(0, 80);
    const analyze = (text) => {
      const hit = tokenList.filter((t) => text.includes(t));
      const snippets = hit.slice(0, 3).map((t) => {
        const i = text.indexOf(t);
        return text.slice(Math.max(0, i - 100), i + t.length + 100).replace(/\s+/g, ' ');
      });
      return { hit, snippets };
    };
    const matchedInline = [], matchedExt = [];
    const liveScripts = [...document.querySelectorAll('script')];
    const scriptType = (sc) => (sc.getAttribute('type') || '').toLowerCase();
    const isJsScript = (sc) => { const t = scriptType(sc); return !t || /javascript|ecmascript|module/.test(t); };
    const hostOf = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
    // every script of the page in document order, so the preview can resolve missing dependencies later
    const allScripts = [];
    let inlineBudget = 8000000;
    liveScripts.forEach((sc, i) => {
      if (!isJsScript(sc)) return;
      const mod = scriptType(sc) === 'module';
      if (sc.src) { if (!SKIP_HOST.test(hostOf(sc.src))) allScripts.push({ i, src: sc.src, mod }); }
      else if (sc.textContent.trim() && sc.textContent.length <= 1500000 && inlineBudget > 0) {
        inlineBudget -= sc.textContent.length;
        allScripts.push({ i, text: sc.textContent, mod });
      }
    });
    // scripts the page loaded dynamically (no <script> tag left in the DOM) are candidates too
    const knownSrc = new Set(allScripts.filter((x) => x.src).map((x) => x.src));
    let dyn = 0;
    try {
      for (const en of performance.getEntriesByType('resource')) {
        if (!/^(script|other|link)$/.test(en.initiatorType) || !/\.m?js(\?|#|$)/i.test(en.name)) continue;
        if (knownSrc.has(en.name) || SKIP_HOST.test(hostOf(en.name))) continue;
        knownSrc.add(en.name);
        allScripts.push({ i: 100000 + dyn++, src: en.name, mod: false });
      }
    } catch {}
    let extCount = 0;
    for (const [i, sc] of liveScripts.entries()) {
      if (root.contains(sc) || !isJsScript(sc)) continue;
      const mod = scriptType(sc) === 'module';
      if (sc.src) {
        if (extCount++ >= 20 || SKIP_HOST.test(hostOf(sc.src))) continue;
        const t = await fetchText(sc.src);
        if (!t || t.length > 2500000) continue;
        const a = analyze(t);
        if (a.hit.length) matchedExt.push({ idx: i, mod, url: sc.src, size: t.length, ...a });
      } else if (sc.textContent.trim()) {
        const t = sc.textContent;
        const a = analyze(t);
        if (a.hit.length) matchedInline.push({ idx: i, mod, text: t, size: t.length, ...a });
      }
    }
    matchedExt.sort((a, b) => b.hit.length - a.hit.length);
    const js = [];
    if (inlineScripts.length) js.push('// ===== 1) Scripts inside the element itself =====\n' + inlineScripts.join('\n\n'));
    if (handlers.length) js.push('// ===== 2) Inline event handlers in the HTML =====\n' + handlers.map((h) => '// ' + h).join('\n'));
    if (matchedInline.length) js.push('// ===== 3) Inline page scripts that reference this element =====\n' + matchedInline.map((m, i) =>
      m.size <= 40000 ? `/* Inline script ${i + 1} — references: ${m.hit.slice(0, 6).join(', ')} */\n${m.text}`
        : `// Large inline script (${m.size} chars) references: ${m.hit.slice(0, 6).join(', ')}\n//   ${m.snippets[0] || ''}`).join('\n\n'));
    if (matchedExt.length) js.push('// ===== 4) External JS files that reference this element (hint only, full code is in the file itself) =====\n' +
      matchedExt.slice(0, 8).map((m) => `// ${m.url}\n//   references: ${m.hit.slice(0, 8).join(', ')}\n` + m.snippets.map((x) => '//   …' + x + '…').join('\n')).join('\n\n'));
    if (!js.length) js.push('// No JavaScript clearly tied to this element was found.\n// If it has behavior (interaction or animation), it most likely comes from a library or bundled file that cannot be separated automatically.');

    // ancestor chain (empty shells) so selectors like ".parent .child" still match in the preview / ZIP
    const openTags = [], closeTags = [];
    for (let a = root.parentElement, d = 0; a && a !== document.body && a !== document.documentElement && d < 12; a = a.parentElement, d++) {
      const tag = a.tagName.toLowerCase();
      if (VOID.has(tag)) continue;
      const shell = a.cloneNode(false).outerHTML, closer = '</' + tag + '>';
      openTags.unshift(shell.slice(0, shell.length - closer.length));
      closeTags.push(closer);
    }
    const attrStr = (el) => el ? [...el.attributes].map((at) => at.name + '="' + at.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"').join(' ') : '';
    const accurate = buildAccurate(root, fontRules);
    const shadowCount = nodes.filter((n) => n.shadowRoot).length;

    return {
      url: location.href, title: document.title, selector: pathOf(root), tag: root.tagName.toLowerCase(),
      html, css, js: js.join('\n\n'), extScripts,
      htmlAttrs: attrStr(document.documentElement), bodyAttrs: attrStr(document.body),
      wrapOpen: openTags.join(''), wrapClose: closeTags.join(''),
      accurate, shadowCount,
      // everything the live preview (and the code ZIP) executes, in the page's original order
      run: (() => {
        const items = [];
        liveScripts.forEach((sc, i) => {
          if (!root.contains(sc) || !isJsScript(sc)) return;
          const mod = scriptType(sc) === 'module';
          if (sc.src) items.push({ i, src: sc.src, mod });
          else if (sc.textContent.trim()) items.push({ i, text: sc.textContent, mod });
        });
        matchedInline.forEach((m) => { if (m.text.length <= 400000) items.push({ i: m.idx, text: m.text, mod: m.mod }); });
        matchedExt.slice(0, 5).forEach((m) => items.push({ i: m.idx, src: m.url, mod: m.mod }));
        const seen = new Set();
        const uniq = items.filter((x) => !seen.has(x.i) && seen.add(x.i)).sort((x, y) => x.i - y.i);
        return { items: uniq, external: uniq.filter((x) => x.src).map((x) => x.src), inline: uniq.filter((x) => x.text).map((x) => x.text) };
      })(),
      allScripts,
      notes: { fetchedViaProxy, failedSheets, matchedExt: matchedExt.map((m) => m.url) }
    };
  }
  window.__seExtract = extract;

  /* ================= picker UI ================= */
  window.__sePickerActive = true;
  const Z = 2147483647;
  const box = document.createElement('div');
  box.style.cssText = `position:fixed;pointer-events:none;z-index:${Z};border:2px solid #49868d;background:rgba(155,187,183,.28);box-sizing:border-box;display:none`;
  const tip = document.createElement('div');
  tip.style.cssText = `position:fixed;pointer-events:none;z-index:${Z};background:#111;color:#fff;font:12px/1.4 monospace;padding:4px 8px;border-radius:4px;display:none;direction:ltr;max-width:80vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
  const bar = document.createElement('div');
  bar.textContent = 'Click to pick the element  •  ↑ parent  •  ↓ child  •  Esc to cancel';
  bar.style.cssText = `position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:${Z};background:#49868d;color:#fff;font:14px 'Segoe UI',system-ui,Arial,sans-serif;padding:8px 18px;border-radius:999px;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,.3)`;
  document.documentElement.append(box, tip, bar);

  let target = null;
  const ours = (el) => el === box || el === tip || el === bar || el?.id === '__site_extractor_toolbar_host__' || el?.closest?.('#__site_extractor_toolbar_host__');
  function show(el) {
    target = el;
    const r = el.getBoundingClientRect();
    Object.assign(box.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    tip.textContent = describe(el) + `  ${Math.round(r.width)}×${Math.round(r.height)}`;
    tip.style.display = 'block';
    tip.style.left = Math.max(4, Math.min(r.left, innerWidth - 200)) + 'px';
    tip.style.top = (r.top > 30 ? r.top - 28 : r.bottom + 4) + 'px';
  }
  const stop = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };
  function cleanup() {
    for (const [t, f] of handlersMap) window.removeEventListener(t, f, true);
    box.remove(); tip.remove(); bar.remove();
    window.__sePickerActive = false;
  }
  async function finish() {
    const el = target;
    cleanup();
    if (!el) return;
    const toast = document.createElement('div');
    toast.textContent = 'Extracting element...';
    toast.style.cssText = `position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:${Z};background:#059669;color:#fff;font:14px 'Segoe UI',system-ui,Arial,sans-serif;padding:8px 18px;border-radius:999px`;
    document.documentElement.append(toast);
    try {
      const bundle = await extract(el);
      await chrome.runtime.sendMessage({ type: 'pickResult', bundle });
    } catch (e) {
      alert('Extraction failed: ' + (e && e.message || e));
    }
    toast.remove();
  }
  const handlersMap = [
    ['mousemove', (e) => { const el = document.elementFromPoint(e.clientX, e.clientY); if (el && !ours(el) && el !== document.documentElement) show(el); }],
    ['click', (e) => { stop(e); finish(); }],
    ['mousedown', stop], ['mouseup', stop], ['pointerdown', stop], ['pointerup', stop], ['touchstart', stop],
    ['keydown', (e) => {
      if (e.key === 'Escape') { stop(e); cleanup(); }
      else if (e.key === 'ArrowUp' && target && target.parentElement && target.parentElement !== document.documentElement) { stop(e); show(target.parentElement); }
      else if (e.key === 'ArrowDown' && target && target.firstElementChild) { stop(e); show(target.firstElementChild); }
      else if (e.key === 'Enter') { stop(e); finish(); }
    }]
  ];
  for (const [t, f] of handlersMap) window.addEventListener(t, f, true);
})();
