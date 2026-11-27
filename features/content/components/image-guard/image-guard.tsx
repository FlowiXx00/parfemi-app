"use client";

import { useEffect } from "react";

const CLASS_NAME = "protect-images";

function isImage(target: EventTarget | null) {
  return target instanceof HTMLImageElement || target instanceof HTMLCanvasElement;
}

function blockOnImages(event: Event) {
  if (isImage(event.target)) event.preventDefault();
}

/**
 * Discourages casual copying of product photos in the shop: no "Save image as…" on right-click or
 * long-press, no dragging an image out of the page. A determined person can still take a screenshot;
 * this only removes the effortless copy. Only images and canvases are affected, so text and links keep
 * their normal menu. The admin panel (another layout) is not affected.
 */
export default function ImageGuard() {
  useEffect(() => {
    const root = document.documentElement;
    // CSS in globals.css: iOS long-press menu and dragging (also for images in portaled dialogs).
    root.classList.add(CLASS_NAME);
    document.addEventListener("contextmenu", blockOnImages);
    document.addEventListener("dragstart", blockOnImages);
    return () => {
      root.classList.remove(CLASS_NAME);
      document.removeEventListener("contextmenu", blockOnImages);
      document.removeEventListener("dragstart", blockOnImages);
    };
  }, []);

  return null;
}
