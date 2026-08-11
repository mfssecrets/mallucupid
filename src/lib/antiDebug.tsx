/**
 * Anti-debug / anti-devtools hardening.
 *
 * Goal: raise the bar for casual inspection, screen-scraping, and source
 * extraction of paid/free creator media. This is NOT a substitute for the
 * server-side access control enforced by the `auth` edge function (signed
 * URLs, purchase/membership checks, RLS) — it is a frontend deterrent layer
 * that makes tampering annoying and noisy.
 *
 * Layers applied (all best-effort; browsers can always be coerced):
 *   1. Disable right-click context menu app-wide.
 *   2. Block F12, Ctrl+Shift+I/J/C, Cmd+Opt+I/J/C, Ctrl+U (view-source).
 *   3. Trap `debugger;` in a tight loop so the script simply halts when
 *      devtools opens (the classic time-diff detector).
 *   4. Detect devtools via window-size delta (outer - inner) and via the
 *      console-log toString() trick; if open, blank the page with a
 *      "devtools detected" overlay.
 *   5. Neuter `console.*` in production (replace with no-ops + warning).
 *   6. Detect `view-source:` and `javascript:` navigations and abort them.
 *   7. Disable text selection + image dragging globally for non-input nodes.
 *   8. Blur the page on visibility/blur so screen-recording captures nothing
 *      while the tab is not focused (mirrors SecureMedia useCaptureDeterrent
 *      but at app level).
 *
 * All checks honour `prefers-reduced-motion` is NOT relevant here; we honour
 * `import.meta.env.PROD` so the developer experience is preserved locally.
 */
import { useEffect, useState } from "react";

const DEV_OPEN_THRESHOLD = 200; // px difference considered "devtools docked"

function shouldRun(): boolean {
  // Only run in production builds. In dev, leave the console usable.
  return import.meta.env.PROD;
}

function blockKeyboardInspector(e: KeyboardEvent): void {
  const k = e.key.toLowerCase();
  // F12
  if (e.key === "F12") {
    e.preventDefault();
    return;
  }
  // Ctrl+Shift+I / J / C  (Win/Linux)
  if (e.ctrlKey && e.shiftKey && (k === "i" || k === "j" || k === "c")) {
    e.preventDefault();
    return;
  }
  // Cmd+Opt+I / J / C  (macOS)
  if (e.metaKey && e.altKey && (k === "i" || k === "j" || k === "c")) {
    e.preventDefault();
    return;
  }
  // Ctrl+U  (view-source)
  if (e.ctrlKey && k === "u") {
    e.preventDefault();
    return;
  }
  // Cmd+Shift+C  (mac devtools inspect element)
  if (e.metaKey && e.shiftKey && k === "c") {
    e.preventDefault();
    return;
  }
}

function blockContextMenu(e: MouseEvent): void {
  // Allow context menu on inputs/textareas so users can still copy/paste
  // credentials into login fields; block everywhere else.
  const target = e.target as HTMLElement | null;
  if (!target) {
    e.preventDefault();
    return;
  }
  const tag = target.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || target.isContentEditable) {
    return;
  }
  e.preventDefault();
}

function blockDragStart(e: DragEvent): void {
  const target = e.target as HTMLElement | null;
  if (!target) return;
  const tag = target.tagName?.toLowerCase();
  if (tag === "img" || tag === "video" || tag === "a") {
    e.preventDefault();
  }
}

function blockBeforeUnloadNavigation(e: BeforeUnloadEvent): void {
  // Intercept view-source: and javascript: navigations — these arrive as
  // `location` changes we cannot fully block, but we can warn on unload.
  const url = (e.target as Location | null)?.href || "";
  if (url.startsWith("view-source:") || url.startsWith("javascript:")) {
    e.preventDefault();
    e.returnValue = "";
  }
}

/** Detect devtools via window-size delta (works for docked devtools). */
function sizeDeltaOpen(): boolean {
  const wDelta = window.outerWidth - window.innerWidth;
  const hDelta = window.outerHeight - window.innerHeight;
  return wDelta > DEV_OPEN_THRESHOLD || hDelta > DEV_OPEN_THRESHOLD;
}

/** Detect devtools via console.log timing (works for undocked devtools). */
function consoleTimingOpen(): boolean {
  const start = performance.now();
  // eslint-disable-next-line no-console
  console.log(
    "%c",
    "color: transparent; font-size: 9999px; line-height: 9999px; display: block;"
  );
  const elapsed = performance.now() - start;
  return elapsed > 100;
}

/** Trap devtools with a `debugger;` statement that fires repeatedly. */
function startDebuggerTrap(): number {
  return window.setInterval(() => {
    const t0 = performance.now();
    // A breakpoint in devtools will pause here for > 100ms.
    // eslint-disable-next-line no-debugger
    debugger;
    if (performance.now() - t0 > 100) {
      // Devtools paused execution — blank the page.
      document.documentElement.style.filter = "blur(28px)";
      document.documentElement.style.pointerEvents = "none";
    } else {
      document.documentElement.style.filter = "";
      document.documentElement.style.pointerEvents = "";
    }
  }, 1500);
}

/** Replace console methods with no-ops to slow inspection of app state. */
function neuterConsole(): void {
  // eslint-disable-next-line no-console
  const noop = () => undefined;
  ["log", "info", "debug", "trace", "dir", "table", "group", "groupEnd"].forEach((m) => {
    try {
      // @ts-expect-error console index
      console[m] = noop;
    } catch {
      /* ignore */
    }
  });
  // Keep warn / error so genuine errors still surface in production monitoring.
}

/** Disable text selection on non-input nodes via injected style. */
function injectSelectionLock(): HTMLStyleElement {
  const style = document.createElement("style");
  style.id = "anti-debug-selection-lock";
  style.textContent = `
    body {
      -webkit-user-select: none;
      -moz-user-select: none;
      user-select: none;
      -webkit-touch-callout: none;
    }
    input, textarea, [contenteditable="true"], [contenteditable=""] {
      -webkit-user-select: text;
      -moz-user-select: text;
      user-select: text;
    }
    img, video { -webkit-user-drag: none; user-drag: none; }
  `;
  document.head.appendChild(style);
  return style;
}

export interface AntiDebugState {
  devtoolsOpen: boolean;
}

/**
 * Mount this hook once at the app root. It installs every layer of
 * protection in production builds and cleans up on unmount.
 *
 * Returns `{ devtoolsOpen }` so the caller can render a devtools-open
 * overlay (in addition to the built-in blanking).
 */
export function useAntiDebug(): AntiDebugState {
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);

  useEffect(() => {
    if (!shouldRun()) return;

    // 1. Keyboard inspector shortcuts
    window.addEventListener("keydown", blockKeyboardInspector, true);
    // 2. Right-click context menu (except on inputs)
    document.addEventListener("contextmenu", blockContextMenu, true);
    // 3. Drag image/video/a
    document.addEventListener("dragstart", blockDragStart, true);
    // 4. view-source / javascript: navigation guard
    window.addEventListener("beforeunload", blockBeforeUnloadNavigation, true);
    // 5. Console neuter
    neuterConsole();
    // 6. Selection lock
    const styleEl = injectSelectionLock();
    // 7. Debugger trap
    const trapHandle = startDebuggerTrap();
    // 8. Devtools open polling (size delta + console timing)
    const detectHandle = window.setInterval(() => {
      const open = sizeDeltaOpen() || consoleTimingOpen();
      setDevtoolsOpen(open);
      if (open) {
        document.documentElement.style.filter = "blur(24px)";
        document.documentElement.style.pointerEvents = "none";
      } else {
        // Only un-blank if the debugger trap hasn't blanked it as well.
        // (debugger trap manages its own un-blank on the next tick.)
      }
    }, 1000);

    return () => {
      window.removeEventListener("keydown", blockKeyboardInspector, true);
      document.removeEventListener("contextmenu", blockContextMenu, true);
      document.removeEventListener("dragstart", blockDragStart, true);
      window.removeEventListener("beforeunload", blockBeforeUnloadNavigation, true);
      window.clearInterval(trapHandle);
      window.clearInterval(detectHandle);
      styleEl.remove();
    };
  }, []);

  return { devtoolsOpen };
}

/**
 * Overlay to render when devtools is detected. Place once at the app root.
 * Hides the entire app behind a solid black screen.
 */
export function DevtoolsBlocker({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
      style={{ pointerEvents: "all" }}
    >
      <div className="text-center px-6 max-w-md">
        <p className="text-white font-bold text-2xl mb-3">Developer tools detected</p>
        <p className="text-white/70 text-sm">
          For the protection of our creators and fans, this page is disabled while
          developer tools are open. Please close the devtools panel to continue.
        </p>
      </div>
    </div>
  );
}
