export function flyToCart(sourceEl: HTMLElement, cartEl: HTMLElement) {
  const from = sourceEl.getBoundingClientRect();
  const to = cartEl.getBoundingClientRect();

  const fromX = from.left + from.width / 2;
  const fromY = from.top + from.height / 2;
  const toX = to.left + to.width / 2;
  const toY = to.top + to.height / 2;

  const deltaX = toX - fromX;
  const deltaY = toY - fromY;

  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  const bug = document.createElement("div");
  bug.style.position = "fixed";
  bug.style.left = `${fromX - 6}px`;
  bug.style.top = `${fromY - 6}px`;
  bug.style.width = "12px";
  bug.style.height = "12px";
  bug.style.borderRadius = "999px";
  bug.style.background = "var(--accent)";
  bug.style.pointerEvents = "none";
  bug.style.zIndex = "10000";
  bug.style.boxShadow = "0 4px 14px rgba(0,0,0,0.18)";
  bug.style.transform = "translate(0, 0) scale(1)";
  bug.style.opacity = "1";
  bug.style.transition =
    "transform 700ms cubic-bezier(.22,.8,.22,1), opacity 700ms ease";

  const tail = document.createElement("div");
  tail.style.position = "absolute";
  tail.style.left = "-22px";
  tail.style.top = "50%";
  tail.style.width = "22px";
  tail.style.height = "2px";
  tail.style.transform = "translateY(-50%)";
  tail.style.transformOrigin = "right center";
  tail.style.background =
    "linear-gradient(to left, rgba(17,17,17,0.55), rgba(17,17,17,0))";
  tail.style.opacity = "0.9";
  tail.style.borderRadius = "999px";
  tail.style.transition =
    "transform 700ms cubic-bezier(.22,.8,.22,1), opacity 700ms ease";

  bug.appendChild(tail);
  document.body.appendChild(bug);

  requestAnimationFrame(() => {
    bug.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.55)`;
    bug.style.opacity = "0.2";
    tail.style.transform = `translateY(-50%) scaleX(${Math.min(
      Math.max(distance / 120, 1),
      2.2
    )})`;
    tail.style.opacity = "0";
  });

  cartEl.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.12)" },
      { transform: "scale(0.96)" },
      { transform: "scale(1)" },
    ],
    {
      duration: 360,
      delay: 430,
      easing: "ease-out",
    }
  );

  const badge = cartEl.querySelector("span");
  if (badge instanceof HTMLElement) {
    badge.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.22)" },
        { transform: "scale(1)" },
      ],
      {
        duration: 260,
        delay: 470,
        easing: "ease-out",
      }
    );
  }

  setTimeout(() => {
    bug.remove();
  }, 750);
}