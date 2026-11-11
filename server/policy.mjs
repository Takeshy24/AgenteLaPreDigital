export function priorityFor(level, count, low = 3, none = 7) {
  if (count >= none) return { priority: 5, rule: 1 };
  if (count >= low) return { priority: 4, rule: 2 };
  // Compra o Intento de compra (abrió el pago en Stripe): Alta.
  if (level >= 3) return { priority: 2, rule: 3 };
  if (level === 2) return { priority: 3, rule: 4 };
  return { priority: 4, rule: 5 };
}
