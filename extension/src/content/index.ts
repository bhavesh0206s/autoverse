/**
 * Autoverse Content Script — Enhanced Version
 */

(function () {
  "use strict";

  let isRecording = false;
  let sessionId: string | null = null;
  let eventBuffer: any[] = [];
  let batchTimer: number | null = null;
  let inputDebounce: number | null = null;
  let lastScrollY = 0;

  document.documentElement.setAttribute("data-autoverse-extension", "true");

  function getUniqueSelector(el: HTMLElement) {
    if (!el || el === document.body || el === document.documentElement) return null;

    if (el.id) return `#${CSS.escape(el.id)}`;

    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel) return `[aria-label="${ariaLabel.replace(/"/g, '\\"')}"]`;

    const name = el.getAttribute("name");
    if (name) return `[name="${CSS.escape(name)}"]`;

    const className = el.getAttribute("class");
    if (className && className.length < 50 && !className.includes(" ")) {
      return `${el.tagName.toLowerCase()}.${className}`;
    }

    const placeholder = el.getAttribute("placeholder");
    if (placeholder) return `[placeholder="${placeholder.replace(/"/g, '\\"')}"]`;

    if (el.tagName === "INPUT" && ["email", "tel", "url"].includes((el as HTMLInputElement).type)) {
      return `input[type="${(el as HTMLInputElement).type}"]`;
    }

   
    const parts = [];
    let node: HTMLElement | null = el;
    let depth = 0;

    while (node && node !== document.body && node.nodeType === Node.ELEMENT_NODE && depth < 4) {
      const tag = node.tagName.toLowerCase();
      const siblings = Array.from(node.parentElement?.children ?? []).filter(
        (c) => node && c.tagName === node.tagName
      );

      const part = siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(node) + 1})` : tag;

      parts.unshift(part);
      node = node.parentElement as HTMLElement | null;
      depth++;
    }

    return parts.join(" > ") || el.tagName.toLowerCase();
  }

  function getElementMeta(el: HTMLElement) {
    const attrs: Record<string, string> = {};

    for (const name of ["id", "href", "name", "role", "aria-label"]) {
      const v = el.getAttribute(name);
      if (v) attrs[name] = v;
    }

   
    const cls = el.getAttribute("class");
    if (cls && cls.length < 40) {
      attrs["class"] = cls;
    }

    return attrs;
  }

  function getText(el: HTMLElement) {
    return el.textContent?.trim().slice(0, 100) || null;
  }

  function emit(event: any) {
    if (!isRecording) {
      console.log("Event ignored: isRecording=false", event.type);
      return;
    }

   
    if (window.location.host === "localhost:3000" || window.location.host === "localhost:5173") {
      console.log("Event ignored: Dashboard URL filtered", event.type);
      return;
    }

    eventBuffer.push({
      ...event,
      timestamp: Date.now(),
      url: window.location.href,
    });

    scheduleFlush();
  }

  function scheduleFlush() {
    if (batchTimer) clearTimeout(batchTimer);
    batchTimer = window.setTimeout(flushBuffer, 500);
  }

  function flushBuffer() {
    if (!eventBuffer.length || !sessionId) return;

    const batch = eventBuffer.slice();
    eventBuffer = [];

    chrome.runtime
      .sendMessage({
        sessionId,
        events: batch,
      })
      .catch(() => {});
  }


  function onClick(e: MouseEvent) {
    const t = e.target as HTMLElement;

    if (!t || t === document.body || t === document.documentElement) return;
    if (t.closest?.("[data-autoverse-ui]")) {
      console.log("Filtered out: Autoverse UI element");
      return;
    }

    const selector = getUniqueSelector(t);
    console.log("Generated Selector:", selector);

    emit({
      type: "click",
      selector,
      text: getText(t),
      tagName: t.tagName.toLowerCase(),
      role: t.getAttribute("role") || null,
      isSubmit: (t as HTMLButtonElement).type === "submit",
      x: Math.round(e.clientX),
      y: Math.round(e.clientY),
      attributes: getElementMeta(t),
    });
  }

  function onInput(e: Event) {
    const t = e.target as HTMLInputElement;
    if (!["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;

    if (inputDebounce) clearTimeout(inputDebounce);

		inputDebounce = window.setTimeout(() => {
			emit({
				type: "input",
				selector: getUniqueSelector(t),
				value: t.type === "password" ? "***" : t.value,
				inputType: t.type || null,
				name: t.name || null,
				placeholder: t.placeholder || null,
				attributes: getElementMeta(t),
			});
		}, 300);
  }

 
  function onKeyDown(e: KeyboardEvent) {
    const t = e.target as HTMLElement;

    if (e.key === "Enter") {
      emit({
        type: "keydown",
        key: "Enter",
        selector: getUniqueSelector(t),
      });
    }
  }

 
  function onSubmit(e: Event) {
    const t = e.target as HTMLElement;

    emit({
      type: "submit",
      selector: getUniqueSelector(t),
    });
  }

 
  let hoverTimer: number | null = null;
  let lastHoveredSelector: string | null = null;

  function onMouseOver(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (!t || t === document.body || t === document.documentElement) return;
    if (t.closest?.("[data-autoverse-ui]")) return;

    const isInteractive =
      ["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(t.tagName) ||
      t.onclick ||
      t.style.cursor === "pointer";

    if (!isInteractive) return;

    const selector = getUniqueSelector(t);
    if (selector === lastHoveredSelector) return;

    if (hoverTimer) clearTimeout(hoverTimer);

    hoverTimer = window.setTimeout(() => {
      lastHoveredSelector = selector;

      emit({
        type: "mouseover",
        selector,
        text: getText(t),
        tagName: t.tagName.toLowerCase(),
        attributes: getElementMeta(t),
      });
    }, 500);
  }

 
  let scrollThrottle: number | null = null;

  function onScroll() {
    if (scrollThrottle) return;

    scrollThrottle = window.setTimeout(() => {
      const curr = window.scrollY;
      const delta = curr - lastScrollY;

      if (Math.abs(delta) > 500) {
        emit({
          type: "scroll",
          scrollY: Math.round(curr),
          direction: delta > 0 ? "down" : "up",
        });

        lastScrollY = curr;
      }

      scrollThrottle = null;
    }, 100);
  }

 
  function emitNavigation(fromUrl: string | null, toUrl: string | null, method: string) {
    emit({
      type: "navigation",
      fromUrl: fromUrl || null,
      toUrl: toUrl || window.location.href,
      title: document.title,
      method,
    });
  }

 
 

  const _pushState = history.pushState.bind(history);

  history.pushState = (...args) => {
    const from = window.location.href;
    _pushState(...args);
    emitNavigation(from, window.location.href, "pushState");
  };

  window.addEventListener("popstate", () => emitNavigation(null, window.location.href, "popstate"));

  window.addEventListener("hashchange", () =>
    emitNavigation(null, window.location.href, "hashchange")
  );

  window.addEventListener("load", () => {
    emit({ type: "page_loaded" });
  });

 
 

  function attach() {
    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("input", onInput, { capture: true });
    document.addEventListener("keydown", onKeyDown, { capture: true });
    document.addEventListener("submit", onSubmit, { capture: true });
    document.addEventListener("scroll", onScroll, { passive: true });
   

    emitNavigation(null, window.location.href, "load");
  }

  function detach() {
    document.removeEventListener("click", onClick, { capture: true });
    document.removeEventListener("input", onInput, { capture: true });
    document.removeEventListener("keydown", onKeyDown, { capture: true });
    document.removeEventListener("submit", onSubmit, { capture: true });
    document.removeEventListener("scroll", onScroll);
   

    if (batchTimer) clearTimeout(batchTimer);
    if (inputDebounce) clearTimeout(inputDebounce);

    flushBuffer();
  }

 
 

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "START_RECORDING") {
      isRecording = true;
      sessionId = msg.sessionId;
      attach();
    } else if (msg.type === "STOP_RECORDING") {
      isRecording = false;
      sessionId = null;
      detach();
    }
  });

 
 

  window.addEventListener("message", async (event) => {
    if (event.source !== window || !event.data?.type?.startsWith("AUTOVERSE_")) return;

    if (event.data.type === "AUTOVERSE_GET_STATE") {
      try {
        const state = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
        window.postMessage({ type: "AUTOVERSE_STATE", ...state }, "*");
      } catch {
        window.postMessage(
          { type: "AUTOVERSE_STATE", isRecording: false, currentSessionId: null },
          "*"
        );
      }
    }
  });

 
 

  chrome.storage.session
    .get(["isRecording", "currentSessionId"])
    .then((res) => {
      if (res.isRecording && res.currentSessionId) {
        isRecording = res.isRecording;
        sessionId = res.currentSessionId;
        attach();
      }
    })
    .catch(() => {});
})();
