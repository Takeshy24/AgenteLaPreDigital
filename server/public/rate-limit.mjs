export function limitRequests({ max, windowMs }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.ip) ?? []).filter((time) => now - time < windowMs);
    recent.push(now);
    hits.set(req.ip, recent);
    if (hits.size > 5000)
      for (const [ip, times] of hits)
        if (times.every((time) => now - time >= windowMs)) hits.delete(ip);
    if (recent.length > max)
      return res
        .status(429)
        .json({ error: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.' });
    next();
  };
}
