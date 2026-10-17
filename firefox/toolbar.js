(() => {
  if (window.__seToolbarInjected) return;
  window.__seToolbarInjected = true;

  const api = globalThis.browser || globalThis.chrome;

  const HOST_ID = '__site_extractor_toolbar_host__';
  let host = document.getElementById(HOST_ID);
  let isVisible = false;

  const ICON_SRC = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAEiElEQVR42u2XXW8VVRSGnz0ze8/MmXNOv5tiKwihaVrFgkGBRBMVjTRciDHBK/8D13rjjeiN8WcYNSYiMTYaJd5oEFIpJBUIFmiKNC20Ped0vj+2F6cYDP0OhpiwkrnZk8x+Zq13rf1uMXLyE80jDINHHI8B/l8AQggMIR5Y18vPfwpgCEGaZfhxjFgByhACsQUAa6ObN6KYod4ehrf38eXZMaRlUrYVJ0Zew5USV0l+mrjCV7+N4Tk2Wmu0fggAhhBEacrOrg5OHDlMq1ciSjO+Pn+BimNTtm1KSuLaCtuymqXQkOUF0jQp1qFYE0AAaZ7T5nm8f2wEaZpMzt7hUP9OakHAucmbzNTqONLCkZJ6GCEQaK2pui4Lvo8j5ZoQxnqik6ZJkCT8cOkP/CghShJmFusM9m5jeEcfd5eWWAxC5n2fMEkJ05Sj+/Zw8vib9LW30YiiFYV7L8z+w298sNrLIElI8pwsLxi7MUWUpnS3VKmFEYt+iC0tBIIwSUnynBtzdxjs7eHo3j04SnKwfxeTs3PcafiYprHxEujl2r/9wnPYlkU9jAiTlIUg4M/ZOVwpaUQRS1FMnGYYhkGhNTu6Otjd3cVsvY4TKXZ1dzK8vY/Lf82gLHPFVl1TA68ODVBxHG4tLDLv+8w3fG4t1lj0Q/IipxFFxFkGgGfbtHsl5v2Acm5TshWf/XKO079fpKTUqjpYEyBMUkzDIEpTkjQjyjIMAX4cE8QJUZqiiXCkxJEWC35Alhcoy2R0fIIzE1dwlFxzSG0AoNmGfpKgtSYvmnMvTBNqQdQUa0lQDyO0BmWZjE9NM35zms5qGa0hTJLNAQhAa82noz8iBERJyvCOProqZYI4IcnyZruhKYrm/ynLpGQrPNumq1rhpYHd9LRUWYoSPjo9SqH1ipNyzQz4cUyUpLwyNMBgbw93Gz5lx0YIyIqCqnZZCiOEAMMwMIVACIGnFI6UlJRaztgWSnBvCB3bv5dD/Tu5vVin4jpYZlMTnmpOvlrQrHuW5xRa41gWankwuUqRFcXmAQwh8OOYdw7u563n9zE5O0eL66BMk2u+jy2t5sfzHD+OqTgOHRUPaZpcmJqmtVTCVZKq6/zTJZsC0IA0Lcanpnl5aIBtrS34UcLnZ8/jRzF7n3qSOM3QWuPZNra0qLgOra5LLQj59sIlHCnRNOvuKrXqSbnieNJaoyyTiVu3+fibUdIs5+fLV/n+0gRtZY+OskdnpUzJVszU6rR5JUpK4SrJ8QP7effFA5RsRdm28Wx7axootKbiOEzPL/DeF6cI4hhXKlwpafc8ojTFkZKLU9PYlsmRZ5+mADxH8fozg5yZuEo9DLEMY+uGpNB6+ZQLEaLZdlXXobe9lSfaWuhpqeIqyZmJq/x67Tq7ujuJ04wPT33Hgu8jTXNdp7SuHyi0xjINEM3OiLOMRhgRpilhkqK1xlGS02MXcWRTN9fn7lJx7HW9AIDY7MVENM/pf+nl3nqQJEjTRFnWhjbfsCV7wIDet+n9655to5ez9lA94YpZWKVcjy8mjwE2G38DNoAPYHufMNIAAAAASUVORK5CYII=";

  function initToolbar() {
    if (host) return;

    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('data-se-ignore', 'true');
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial !important;
        display: block !important;
        position: static !important;
      }
      :host([hidden]), :host[hidden] {
        display: none !important;
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      .se-toolbar-wrapper {
        position: fixed !important;
        z-index: 2147483647 !important;
        left: 50%;
        transform: translateX(-50%);
        bottom: 20px;
        top: auto;
        pointer-events: auto !important;
        font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        transition: top 0.28s cubic-bezier(0.15, 1, 0.4, 1), left 0.28s cubic-bezier(0.15, 1, 0.4, 1);
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        touch-action: none;
      }
      .se-toolbar-wrapper.dragging {
        transition: none !important;
      }
      .se-toolbar {
        height: 40px;
        background: #2c2c2c;
        border-radius: 13px;
        box-shadow: 0 1px 3px 0 rgba(0,0,0,0.18), 0 0 1px 0 rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.38);
        border: 1px solid rgba(255, 255, 255, 0.09);
        display: flex;
        align-items: center;
        padding: 0 6px 0 12px;
        gap: 2px;
        user-select: none;
        -webkit-user-select: none;
        cursor: grab;
        touch-action: none;
        animation: sePop 0.18s cubic-bezier(0.15, 1, 0.4, 1);
      }
      .se-toolbar:active,
      .se-toolbar-wrapper.dragging .se-toolbar {
        cursor: grabbing;
      }
      @keyframes sePop {
        from { opacity: 0; transform: translateY(8px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .se-brand {
        display: flex;
        align-items: center;
        padding-right: 4px;
        cursor: grab;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
      }
      .se-brand:active,
      .se-toolbar-wrapper.dragging .se-brand {
        cursor: grabbing;
      }
      .se-logo {
        width: 18px;
        height: 18px;
        border-radius: 4px;
        display: block;
        flex-shrink: 0;
        pointer-events: none;
        -webkit-user-drag: none;
        user-select: none;
      }
      .se-brand-text {
        font-size: 12px;
        font-weight: 600;
        color: #ffffff;
        margin-left: 7px;
        letter-spacing: 0.2px;
        white-space: nowrap;
        pointer-events: none;
        user-select: none;
      }
      .se-divider {
        width: 1px;
        height: 16px;
        background: rgba(255, 255, 255, 0.12);
        margin: 0 6px 0 8px;
        flex-shrink: 0;
        pointer-events: none;
      }
      .se-divider-sm {
        margin: 0 4px 0 4px;
      }
      .se-btn {
        display: inline-flex;
        align-items: center;
        height: 28px;
        padding: 0 10px 0 6px;
        gap: 6px;
        border: none;
        border-radius: 5px;
        background: transparent;
        color: rgba(255, 255, 255, 0.9);
        font-family: inherit;
        font-size: 12px;
        font-weight: 500;
        line-height: 16px;
        letter-spacing: 0.005em;
        white-space: nowrap;
        cursor: pointer;
        transition: background 120ms ease, color 120ms ease;
        user-select: none;
        -webkit-user-select: none;
      }
      .se-btn span {
        pointer-events: none;
      }
      .se-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
      }
      .se-btn:active {
        background: rgba(255, 255, 255, 0.18);
      }
      .se-icon {
        width: 18px;
        height: 18px;
        display: block;
        flex-shrink: 0;
        fill: currentColor;
        pointer-events: none;
      }
      .se-close-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: none;
        border-radius: 5px;
        background: transparent;
        color: rgba(255, 255, 255, 0.5);
        cursor: pointer;
        transition: background 120ms ease, color 120ms ease;
        user-select: none;
        -webkit-user-select: none;
      }
      .se-close-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
      }
      .se-close-btn:active {
        background: rgba(255, 255, 255, 0.18);
      }
      .se-icon-close {
        width: 18px;
        height: 18px;
        pointer-events: none;
      }
    `;

    const html = `
      <div class="se-toolbar-wrapper" id="seToolbarWrapper">
        <div class="se-toolbar" id="seToolbar">
          <div class="se-brand" id="seBrand" title="Site Ex - Drag anywhere across screen">
            <img src="${ICON_SRC}" class="se-logo" alt="Site Ex" draggable="false" />
            <span class="se-brand-text">Site Ex</span>
          </div>
          <div class="se-divider"></div>
          <button class="se-btn" id="btnCaptureSite" title="Extract all linked pages (HTML, CSS, JS)">
            <svg class="se-icon" viewBox="0 0 24 24"><path d="M10 5.5a.5.5 0 0 1 0 1H9A1.5 1.5 0 0 0 7.5 8v2.5a.5.5 0 0 1-.147.354L6.207 12l1.146 1.146a.5.5 0 0 1 .147.354V16A1.5 1.5 0 0 0 9 17.5h1a.5.5 0 0 1 0 1H9A2.5 2.5 0 0 1 6.5 16v-2.293l-1.354-1.354a.5.5 0 0 1 0-.707L6.5 10.294V8A2.5 2.5 0 0 1 9 5.5zm5 0A2.5 2.5 0 0 1 17.5 8v2.293l1.353 1.354a.5.5 0 0 1 0 .707L17.5 13.707V16a2.5 2.5 0 0 1-2.5 2.5h-1a.5.5 0 1 1 0-1h1a1.5 1.5 0 0 0 1.5-1.5v-2.5a.5.5 0 0 1 .146-.354L17.793 12l-1.147-1.146a.5.5 0 0 1-.146-.354V8A1.5 1.5 0 0 0 15 6.5h-1a.5.5 0 1 1 0-1z"/></svg>
            <span>Capture site</span>
          </button>
          <button class="se-btn" id="btnCapturePage" title="Extract this page only">
            <svg class="se-icon" viewBox="0 0 24 24"><path d="M17 6a2 2 0 0 1 2 2v8l-.01.204a2 2 0 0 1-1.786 1.785L17 18H7l-.204-.01a2 2 0 0 1-1.785-1.786L5 16V8a2 2 0 0 1 2-2zM6 16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5H6zm1-9a1 1 0 0 0-.995.897L6 8v2h12V8a1 1 0 0 0-1-1zm.5 1a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1m2 0a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1"/></svg>
            <span>Capture page</span>
          </button>
          <button class="se-btn" id="btnSelectElement" title="Pick an element from the page">
            <svg class="se-icon" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M16.5 7h-9a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 6 16.5v-9A1.5 1.5 0 0 1 7.5 6h9A1.5 1.5 0 0 1 18 7.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5m-.582 8.917 1.215-.374.072-.022.309-.095.251-.077a.33.33 0 0 0 .024-.623l-.245-.096-.3-.118-.07-.027-3.158-1.241-.022-.009-.213-.083-.33-.13a.33.33 0 0 0-.429.428l.13.33.084.213.009.022 1.24 3.158.028.07.118.3.096.245a.33.33 0 0 0 .622-.023l.078-.252.095-.308.022-.072zm2.141.388-1.341.412-.413 1.342c-.37 1.202-2.049 1.266-2.509.095l-1.704-4.339c-.425-1.08.643-2.149 1.724-1.724l4.338 1.704c1.172.46 1.108 2.14-.095 2.51"/></svg>
            <span>Select element</span>
          </button>
          <div class="se-divider se-divider-sm"></div>
          <button class="se-close-btn" id="btnClose" title="Close">
            <svg class="se-icon se-icon-close" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M17.354 6.646a.5.5 0 0 1 0 .708L12.707 12l4.647 4.646a.5.5 0 0 1-.708.708L12 12.707l-4.646 4.647a.5.5 0 0 1-.708-.708L11.293 12 6.646 7.354a.5.5 0 0 1 .708-.707L12 11.293l4.646-4.647a.5.5 0 0 1 .708 0"/></svg>
          </button>
        </div>
      </div>
    `;

    shadow.appendChild(style);
    const container = document.createElement('div');
    container.innerHTML = html;
    shadow.appendChild(container);
    document.documentElement.appendChild(host);

    // Free 2D Dragging & Snap to Top or Bottom Center
    const wrapper = shadow.getElementById('seToolbarWrapper');
    const toolbarEl = shadow.getElementById('seToolbar');

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let activePointerId = null;

    toolbarEl.addEventListener('pointerdown', (e) => {
      // Don't drag if clicking buttons
      if (e.target.closest('button')) return;
      if (e.button !== 0) return;

      isDragging = true;
      activePointerId = e.pointerId;
      try {
        toolbarEl.setPointerCapture(e.pointerId);
      } catch (_) {}

      const rect = wrapper.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;

      // Switch to free pixel positioning without transition
      wrapper.classList.add('dragging');
      wrapper.style.setProperty('left', startLeft + 'px', 'important');
      wrapper.style.setProperty('top', startTop + 'px', 'important');
      wrapper.style.setProperty('bottom', 'auto', 'important');
      wrapper.style.setProperty('transform', 'none', 'important');

      document.documentElement.style.setProperty('user-select', 'none', 'important');

      const onPointerMove = (ev) => {
        if (!isDragging) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        const w = wrapper.offsetWidth || 350;
        const h = wrapper.offsetHeight || 40;
        const minLeft = 10;
        const maxLeft = Math.max(minLeft, window.innerWidth - w - 10);
        const minTop = 10;
        const maxTop = Math.max(minTop, window.innerHeight - h - 10);

        const newLeft = Math.max(minLeft, Math.min(maxLeft, startLeft + dx));
        const newTop = Math.max(minTop, Math.min(maxTop, startTop + dy));

        wrapper.style.setProperty('left', newLeft + 'px', 'important');
        wrapper.style.setProperty('top', newTop + 'px', 'important');
        wrapper.style.setProperty('bottom', 'auto', 'important');
        wrapper.style.setProperty('transform', 'none', 'important');
      };

      const onPointerUp = () => {
        if (!isDragging) return;
        isDragging = false;

        if (activePointerId !== null) {
          try {
            toolbarEl.releasePointerCapture(activePointerId);
          } catch (_) {}
          activePointerId = null;
        }

        window.removeEventListener('pointermove', onPointerMove, true);
        window.removeEventListener('pointerup', onPointerUp, true);
        window.removeEventListener('pointercancel', onPointerUp, true);

        document.documentElement.style.removeProperty('user-select');

        const currentRect = wrapper.getBoundingClientRect();
        const currentCenterY = currentRect.top + currentRect.height / 2;
        const screenMidY = window.innerHeight / 2;
        const isUpper = currentCenterY < screenMidY;

        // Target coordinates: Always centered horizontally!
        const targetLeft = Math.max(10, (window.innerWidth - currentRect.width) / 2);
        const targetTop = isUpper ? 20 : Math.max(10, window.innerHeight - currentRect.height - 20);

        // Remove dragging class to restore smooth CSS transition
        wrapper.classList.remove('dragging');
        void wrapper.offsetWidth; // Force reflow so transition applies

        // Glide smoothly to target position
        wrapper.style.setProperty('left', targetLeft + 'px', 'important');
        wrapper.style.setProperty('top', targetTop + 'px', 'important');

        let finalized = false;
        const finalizeDock = () => {
          if (finalized || isDragging) return;
          finalized = true;
          wrapper.removeEventListener('transitionend', onTransitionEnd);

          // Once reached destination, dock using responsive rules
          wrapper.style.setProperty('transition', 'none', 'important');
          wrapper.style.setProperty('left', '50%', 'important');
          wrapper.style.setProperty('transform', 'translateX(-50%)', 'important');

          if (isUpper) {
            wrapper.style.setProperty('top', '20px', 'important');
            wrapper.style.setProperty('bottom', 'auto', 'important');
          } else {
            wrapper.style.setProperty('bottom', '20px', 'important');
            wrapper.style.setProperty('top', 'auto', 'important');
          }

          void wrapper.offsetWidth;
          wrapper.style.removeProperty('transition');
        };

        const onTransitionEnd = (te) => {
          if ((te.propertyName === 'top' || te.propertyName === 'left') && !isDragging) {
            finalizeDock();
          }
        };

        wrapper.addEventListener('transitionend', onTransitionEnd);
        setTimeout(finalizeDock, 320);
      };

      window.addEventListener('pointermove', onPointerMove, true);
      window.addEventListener('pointerup', onPointerUp, true);
      window.addEventListener('pointercancel', onPointerUp, true);
      e.preventDefault();
    });

    // Button actions
    const btnSite = shadow.getElementById('btnCaptureSite') || shadow.getElementById('btnCaptureCode');
    if (btnSite) {
      btnSite.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await api.runtime.sendMessage({
            type: 'startCrawl',
            url: location.href,
            all: true
          });
        } catch (err) {
          console.error('Failed to start site crawl:', err);
        }
      });
    }

    const btnPage = shadow.getElementById('btnCapturePage');
    if (btnPage) {
      btnPage.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await api.runtime.sendMessage({
            type: 'startCrawl',
            url: location.href,
            all: false
          });
        } catch (err) {
          console.error('Failed to start page crawl:', err);
        }
      });
    }

    const btnSelect = shadow.getElementById('btnSelectElement');
    if (btnSelect) {
      btnSelect.addEventListener('click', async (e) => {
        e.stopPropagation();
        hideToolbar();
        try {
          await api.runtime.sendMessage({ type: 'startPicker' });
        } catch (err) {
          console.error('Failed to start element picker:', err);
        }
      });
    }

    // Close button (X)
    const btnClose = shadow.getElementById('btnClose');
    if (btnClose) {
      btnClose.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        hideToolbar();
      });
    }
  }

  function showToolbar() {
    initToolbar();
    if (host) {
      host.removeAttribute('hidden');
      host.style.removeProperty('display');
    }
    isVisible = true;
  }

  function hideToolbar() {
    if (host) {
      host.setAttribute('hidden', '');
      host.style.setProperty('display', 'none', 'important');
    }
    isVisible = false;
  }

  function toggleToolbar() {
    if (isVisible && host && !host.hasAttribute('hidden') && host.style.display !== 'none') {
      hideToolbar();
    } else {
      showToolbar();
    }
  }

  // Listen for messages from background script
  api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'toggleToolbar') {
      toggleToolbar();
      sendResponse({ ok: true, visible: isVisible });
      return true;
    }
    if (msg && msg.type === 'showToolbar') {
      showToolbar();
      sendResponse({ ok: true, visible: true });
      return true;
    }
    if (msg && msg.type === 'hideToolbar') {
      hideToolbar();
      sendResponse({ ok: true, visible: false });
      return true;
    }
  });
})();
