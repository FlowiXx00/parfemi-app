"use client";

import { useEffect } from "react";

export default function TextFitProvider() {
  useEffect(() => {
    const registered = new Map<HTMLElement, ResizeObserver>();
    let resizeRaf = 0;

    const fitElement = (el: HTMLElement) => {
      const max = Number(el.dataset.autofitMax ?? 15);
      const min = Number(el.dataset.autofitMin ?? 10);
      const step = Number(el.dataset.autofitStep ?? 0.5);

      let size = max;
      el.style.fontSize = `${max}px`;

      while (el.scrollWidth > el.clientWidth && size > min) {
        size -= step;
        el.style.fontSize = `${size}px`;
      }
    };

    const register = (el: HTMLElement) => {
      if (registered.has(el)) return;

      const ro = new ResizeObserver(() => {
        fitElement(el);
      });

      ro.observe(el);
      if (el.parentElement) {
        ro.observe(el.parentElement);
      }

      registered.set(el, ro);

      requestAnimationFrame(() => {
        fitElement(el);
      });
    };

    const unregister = (el: HTMLElement) => {
      const ro = registered.get(el);
      if (!ro) return;
      ro.disconnect();
      registered.delete(el);
    };

    const scan = (root: ParentNode = document) => {
      root.querySelectorAll?.("[data-autofit]").forEach((node) => {
        if (node instanceof HTMLElement) {
          register(node);
        }
      });
    };

    const mo = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;

          if (node.matches("[data-autofit]")) {
            register(node);
          }

          scan(node);
        });

        mutation.removedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;

          if (node.matches("[data-autofit]")) {
            unregister(node);
          }

          node.querySelectorAll?.("[data-autofit]").forEach((child) => {
            if (child instanceof HTMLElement) {
              unregister(child);
            }
          });
        });
      }
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scan();

        mo.observe(document.body, {
          childList: true,
          subtree: true,
        });
      });
    });

    const onResize = () => {
      if (resizeRaf) {
        cancelAnimationFrame(resizeRaf);
      }

      resizeRaf = requestAnimationFrame(() => {
        registered.forEach((_, el) => fitElement(el));
        resizeRaf = 0;
      });
    };

    window.addEventListener("resize", onResize);

    return () => {
      mo.disconnect();
      window.removeEventListener("resize", onResize);
      if (resizeRaf) {
        cancelAnimationFrame(resizeRaf);
      }
      registered.forEach((ro) => ro.disconnect());
      registered.clear();
    };
  }, []);

  return null;
}