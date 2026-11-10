import { useEffect, useRef, useState } from 'react';

export function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !('IntersectionObserver' in window)) return;
    root.setAttribute('data-motion-ready', 'true');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-visible', 'true');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.06 },
    );
    const observeCards = () =>
      root
        .querySelectorAll('[data-reveal]:not([data-visible])')
        .forEach((element) => observer.observe(element));
    observeCards();
    const changes = new MutationObserver((records) => {
      if (
        records.some((record) =>
          Array.from(record.addedNodes).some((node) => node.nodeType === Node.ELEMENT_NODE),
        )
      )
        observeCards();
    });
    changes.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      changes.disconnect();
    };
  }, []);
  return ref;
}

export function AnimatedPrice({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const start = performance.now();
    const from = current.current;
    const finish = () => {
      cancelAnimationFrame(frame);
      current.current = value;
      setDisplay(value);
    };
    if (preference.matches) {
      finish();
      return;
    }
    const tick = (now: number) => {
      const progress = Math.min((now - start) / 420, 1);
      current.current = from + (value - from) * (1 - Math.pow(1 - progress, 3));
      setDisplay(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const onPreference = () => {
      if (preference.matches) finish();
    };
    preference.addEventListener('change', onPreference);
    return () => {
      cancelAnimationFrame(frame);
      preference.removeEventListener('change', onPreference);
    };
  }, [value]);
  const format = (price: number) =>
    price.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <>
      <span className="sr-only">S/ {format(value)}</span>
      <strong aria-hidden="true">{format(display)}</strong>
    </>
  );
}
