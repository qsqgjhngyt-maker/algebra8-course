/* =====================================================================
   Kitsune Navigation Stability v2.3.0-beta.3.9.6

   Fixes:
   - sidebar "Главная" works reliably from every screen;
   - "← Вернуться к обучению" works reliably from Adult Center.

   Important:
   This script is loaded AFTER student-experience-v220.js, therefore it keeps
   Student Experience's wrapped renderHome(), but BEFORE app-kernel-v200.js,
   so its capture handler can own only the two affected navigation actions.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION = "2.3.0-beta.3.9.6";
  const capturedStudentHome =
    typeof window.renderHome === "function"
      ? window.renderHome.bind(window)
      : null;

  let navigatingHome = false;

  function closeMobileSidebar() {
    try {
      document.querySelector("#sidebar")?.classList.remove("open");
      document.body.classList.remove("sidebar-mobile-open");
      document.querySelector("#sidebarScrim")?.setAttribute("aria-hidden", "true");
    } catch {}
  }

  function homeLooksOpen() {
    const title = String(document.querySelector("#pageTitle")?.textContent || "").trim();
    const homeButton = document.querySelector('.nav-btn[data-view="home"]');
    return title === "Алгебра 8" &&
      !!homeButton &&
      (homeButton.classList.contains("active") || !!document.querySelector("#homeTopics, .sx-dashboard"));
  }

  function normalizeHomeUi() {
    try {
      document.querySelectorAll(".nav-btn").forEach(button => {
        button.classList.toggle("active", button.dataset.view === "home");
      });
      const title = document.querySelector("#pageTitle");
      if (title) title.textContent = "Алгебра 8";
      closeMobileSidebar();
    } catch {}
  }

  function invokeHomeRenderer() {
    const current = typeof window.renderHome === "function"
      ? window.renderHome
      : null;

    let firstError = null;

    if (current) {
      try {
        current.call(window);
        if (homeLooksOpen()) return true;
      } catch (error) {
        firstError = error;
      }
    }

    /* Backup is the Student Experience home wrapper captured before App Kernel
       and later performance wrappers can replace window.renderHome. */
    if (capturedStudentHome && current !== capturedStudentHome) {
      try {
        capturedStudentHome();
        if (homeLooksOpen()) return true;
      } catch (error) {
        if (!firstError) firstError = error;
      }
    }

    /* Last fallback uses the original template directly. It is intentionally
       minimal and only runs if both normal renderHome paths fail. */
    try {
      const template = document.querySelector("#homeTpl");
      const content = document.querySelector("#content");
      if (template && content) {
        content.innerHTML = template.innerHTML;
        normalizeHomeUi();

        /* Re-run the current home renderer asynchronously once the basic
           screen is already usable, so progress/cards can populate normally. */
        setTimeout(() => {
          try {
            if (typeof window.renderHome === "function") {
              window.renderHome.call(window);
            }
          } catch {}
        }, 0);

        return true;
      }
    } catch {}

    if (firstError) {
      try { console.error("[Kitsune navigation] home render failed", firstError); } catch {}
    }
    return false;
  }

  function goHome(source = "home") {
    if (navigatingHome) return false;
    navigatingHome = true;

    try {
      closeMobileSidebar();

      const opened = invokeHomeRenderer();

      if (opened) {
        normalizeHomeUi();

        try {
          window.dispatchEvent(new CustomEvent("kitsune-navigation-home", {
            detail: { source, version: VERSION }
          }));
        } catch {}

        return true;
      }

      return false;
    } finally {
      setTimeout(() => { navigatingHome = false; }, 0);
    }
  }

  /* Capture is intentional. App Kernel also owns document capture and calls
     stopImmediatePropagation(); registering here earlier guarantees these two
     actions cannot be swallowed by another router. */
  document.addEventListener("click", event => {
    const target = event.target.closest?.(
      '.nav-btn[data-view="home"], #sxBackStudent'
    );
    if (!target) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const source = target.id === "sxBackStudent"
      ? "adult-back"
      : "sidebar-home";

    goHome(source);
  }, true);

  window.KitsuneNavigationStability = {
    version: VERSION,
    home: goHome
  };
})();
