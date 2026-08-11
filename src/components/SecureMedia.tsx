import React, { useEffect, useState } from "react";

/**
 * Frontend deterrents only. Real access control is enforced by the auth edge
 * function (cookie + purchase/membership checks before any short-lived media URL).
 * OS-level screenshots and screen recording cannot be fully blocked in a browser.
 */
export function useCaptureDeterrent() {
  const [obscured, setObscured] = useState(false);

  useEffect(() => {
    const sync = () => setObscured(document.hidden || !document.hasFocus());
    const blockKeys = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (
        key === "printscreen" ||
        (event.metaKey && event.shiftKey && (key === "3" || key === "4" || key === "5")) ||
        (event.ctrlKey && key === "p")
      ) {
        event.preventDefault();
        setObscured(true);
        window.setTimeout(() => setObscured(document.hidden || !document.hasFocus()), 800);
      }
    };
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("blur", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("keydown", blockKeys, true);
    sync();
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("blur", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("keydown", blockKeys, true);
    };
  }, []);

  return obscured;
}

export function CaptureShield({
  watermark,
  active,
}: {
  watermark: string;
  active: boolean;
}) {
  if (!active) return null;
  return (
    <div className="fixed inset-0 z-[500] bg-black flex items-center justify-center pointer-events-none">
      <div className="text-center px-6">
        <p className="text-white font-bold text-lg">Protected content</p>
        <p className="text-white/60 text-sm mt-2">{watermark}</p>
      </div>
    </div>
  );
}

export function SecureImage({
  src,
  alt = "",
  className = "",
  watermark = "",
}: {
  src: string;
  alt?: string;
  className?: string;
  watermark?: string;
}) {
  return (
    <div
      className={`relative select-none ${className}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      style={{ WebkitTouchCallout: "none", userSelect: "none" }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="w-full h-full object-contain pointer-events-none"
      />
      {watermark ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.14]">
          <div className="absolute inset-[-20%] rotate-[-24deg] flex flex-wrap gap-10 content-center justify-center text-[11px] font-bold text-white tracking-widest">
            {Array.from({ length: 24 }).map((_, i) => (
              <span key={i}>{watermark}</span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const SecureVideo = React.forwardRef<
  HTMLVideoElement,
  React.VideoHTMLAttributes<HTMLVideoElement> & { watermark?: string }
>(function SecureVideo({ src, className = "", watermark = "", ...videoProps }, ref) {
  return (
    <div
      className={`relative select-none ${className}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      style={{ WebkitTouchCallout: "none", userSelect: "none" }}
    >
      <video
        {...videoProps}
        ref={ref}
        src={src}
        className={`w-full h-full ${videoProps.className || ""}`}
        controlsList="nodownload noplaybackrate noremoteplayback"
        disablePictureInPicture
        playsInline
        onContextMenu={(e) => e.preventDefault()}
      />
      {watermark ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.12]">
          <div className="absolute inset-[-20%] rotate-[-24deg] flex flex-wrap gap-10 content-center justify-center text-[11px] font-bold text-white tracking-widest">
            {Array.from({ length: 18 }).map((_, i) => (
              <span key={i}>{watermark}</span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
});
