/* =====================================================================
   Kitsune Mobile Voice Entry v2.3.0-beta.3.9.7

   Why this exists:
   On Careful/Balanced devices the heavy assistant/voice stack is intentionally
   NOT background-loaded. Previously the buttons "Поговорить" and
   "Сказать Kitsune" were created by kitsune-voice-v19.js itself, so on mobile
   the user had no button that could explicitly request that very module.

   This is a tiny core bridge:
   - renders the same two voice-entry buttons without loading any AI model;
   - on click lazily loads the existing assistant group;
   - then opens the original KitsuneVoiceDialogue with the correct exercise
     context;
   - does not enable auto speech and does not preload Whisper/Brain.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION = "2.3.0-beta.3.9.7";
  let contentObserver = null;

  function currentContext() {
    try {
      if (typeof window.v16CurrentContext === "function") {
        const ctx = window.v16CurrentContext();
        if (ctx?.exercise && ctx?.box?.isConnected) return ctx;
      }
    } catch {}
    return null;
  }

  function contextForPanel(panel) {
    const box = panel?.closest?.(".exercise[data-ex]");
    try {
      if (box && typeof window.v16ParseExercise === "function") {
        const ctx = window.v16ParseExercise(box);
        if (ctx?.exercise && ctx?.box?.isConnected) return ctx;
      }
    } catch {}
    return currentContext();
  }

  function chip(text) {
    try {
      if (typeof window.v15Chip === "function") {
        window.v15Chip(text);
        return;
      }
    } catch {}
    console.warn("[Kitsune voice entry]", text);
  }

  async function ensureAssistant(button) {
    const loader = window.KitsuneRuntimeLoader;

    if (!loader?.ensure) {
      throw new Error("Голосовой модуль ещё не готов к загрузке.");
    }

    if (loader.ready?.("assistant")) return true;

    const oldText = button?.textContent || "";
    if (button) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "⏳ Готовлю диалог…";
    }

    try {
      await loader.ensure("assistant", {
        urgent: true,
        reason: "explicit-voice-entry",
        background: false
      });
      return true;
    } finally {
      if (button) {
        button.disabled = false;
        button.removeAttribute("aria-busy");
        button.textContent = oldText;
      }
    }
  }

  async function openDialogue(button, ctx = null) {
    try {
      await ensureAssistant(button);

      const api = window.KitsuneVoiceDialogue;
      if (!api?.open) {
        throw new Error("Диалог Kitsune загрузился не полностью.");
      }

      api.open(ctx);
    } catch (error) {
      chip(String(error?.message || error || "Не удалось открыть разговор с Kitsune."));
    }
  }

  function ensureFreeTalkButton() {
    const actions = document.querySelector("#v15Assistant .v15-actions");
    if (!actions) return false;

    let button = actions.querySelector(".v19-open-dialog");

    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "v15-action v19-open-dialog";
      button.textContent = "💬 Поговорить";
      actions.appendChild(button);
    }

    if (!button.__kitsuneVoiceEntry2397) {
      button.__kitsuneVoiceEntry2397 = true;
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        openDialogue(button, currentContext());
      });
    }

    return true;
  }

  function ensureInlineTalkButton(panel) {
    if (!panel?.isConnected) return false;

    const controls = panel.querySelector(".v173-controls");
    if (!controls) return false;

    let button = controls.querySelector(".v19-inline-talk");

    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "v173-btn v19-inline-talk";
      button.textContent = "🎙️ Сказать Kitsune";
      controls.appendChild(button);
    }

    if (!button.__kitsuneVoiceEntry2397) {
      button.__kitsuneVoiceEntry2397 = true;
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        openDialogue(button, contextForPanel(panel));
      });
    }

    return true;
  }

  function ensureInlineTalkButtons(root = document) {
    if (root?.matches?.(".v173-inline-tutor")) {
      ensureInlineTalkButton(root);
    }

    root?.querySelectorAll?.(".v173-inline-tutor")?.forEach(ensureInlineTalkButton);
  }

  function scan(root = document) {
    ensureFreeTalkButton();
    ensureInlineTalkButtons(root);
  }

  function installContentObserver() {
    const content = document.querySelector("#content");
    if (!content || content.__kitsuneVoiceEntryObserver2397) return false;

    content.__kitsuneVoiceEntryObserver2397 = true;

    contentObserver = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node?.nodeType !== 1) continue;

          if (
            node.matches?.(".v173-inline-tutor") ||
            node.querySelector?.(".v173-inline-tutor")
          ) {
            ensureInlineTalkButtons(node);
          }
        }
      }
    });

    contentObserver.observe(content, {
      childList: true,
      subtree: true
    });

    return true;
  }

  /*
   * Tutor panels can be opened manually or automatically after a wrong answer.
   * The observer handles both cases; these timers only cover initial startup.
   */
  scan();
  installContentObserver();

  setTimeout(() => {
    scan();
    installContentObserver();
  }, 120);

  setTimeout(scan, 600);
  setTimeout(scan, 1600);

  window.addEventListener("kitsune-runtime-group-loaded", event => {
    if (event?.detail?.group === "assistant") scan();
  });

  window.KitsuneMobileVoiceEntry = {
    version: VERSION,
    scan,
    open: openDialogue
  };
})();
