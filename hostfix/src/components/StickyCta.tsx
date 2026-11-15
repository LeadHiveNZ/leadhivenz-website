"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "./forms/styles";

/**
 * On phones, a button that stays at the bottom of the screen once the sign-up
 * form has scrolled out of view. Tapping it jumps back to the form.
 */
export function StickyCta({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById("signup");
    if (!target || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry) setVisible(!entry.isIntersecting);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 p-3 backdrop-blur transition-transform duration-200 lg:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      aria-hidden={!visible}
    >
      <a href="#signup" className={`${buttonClass} w-full`} tabIndex={visible ? 0 : -1}>
        {label}
      </a>
    </div>
  );
}
