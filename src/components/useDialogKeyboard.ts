"use client";

import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";

const focusable = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])";

export function useDialogKeyboard<T extends HTMLElement>(onClose: () => void, initialFocus: RefObject<HTMLElement | null>) {
  const dialogRef = useRef<T>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    initialFocus.current?.focus();
    if (dialogRef.current) return () => previous?.focus();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) return () => previous?.focus();
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== "Tab") return;
      const elements = Array.from(dialog.querySelectorAll<HTMLElement>(focusable)).filter((element) => element.getClientRects().length > 0);
      if (!elements.length) return;
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("keydown", handleKeyDown); previous?.focus(); };
  }, [initialFocus]);
  function onKeyDown(event: KeyboardEvent<T>) { if (event.key === "Escape") { event.preventDefault(); onClose(); return; } if (event.key !== "Tab" || !dialogRef.current) return; const elements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusable)).filter((element) => element.getClientRects().length > 0); if (!elements.length) return; const first = elements[0]; const last = elements[elements.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
  return { dialogRef, onKeyDown };
}
