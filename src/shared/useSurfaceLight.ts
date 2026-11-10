import { useEffect, useRef, type PointerEvent } from 'react';

/** Cursor light is shared; tilt is reserved for commercial cards. */
export function useSurfaceLight(tilt = false) {
  const ref = useRef<HTMLElement>(null);
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (
      event.pointerType !== 'mouse' ||
      !window.matchMedia('(hover: hover) and (pointer: fine)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      ref.current?.style.setProperty('--light-x', `${x * 100}%`);
      ref.current?.style.setProperty('--light-y', `${y * 100}%`);
      if (tilt) {
        ref.current?.style.setProperty('--tilt-x', `${(0.5 - y) * 2}deg`);
        ref.current?.style.setProperty('--tilt-y', `${(x - 0.5) * 2}deg`);
      }
    });
  };
  const onPointerLeave = () => {
    cancelAnimationFrame(frame.current);
    ref.current?.style.setProperty('--tilt-x', '0deg');
    ref.current?.style.setProperty('--tilt-y', '0deg');
  };
  return { ref, onPointerMove, onPointerLeave };
}
