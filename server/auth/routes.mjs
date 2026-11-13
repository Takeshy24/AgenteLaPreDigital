import { z } from 'zod';
import { limitRequests } from '../public/rate-limit.mjs';
import {
  authenticate,
  createSession,
  endSession,
  sessionUser,
  SESSION_DURATION,
} from './service.mjs';

const COOKIE_NAME = 'lapredigital_session';
const credentials = z
  .object({ username: z.string().trim().min(1).max(50), password: z.string().min(1).max(256) })
  .strict();
const cookieOptions = (req) => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: req.secure,
  path: '/api',
});
export function sessionToken(req) {
  return req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(COOKIE_NAME + '='))
    ?.slice(COOKIE_NAME.length + 1);
}
export function requireSession(req, res, next) {
  if (req.path.startsWith('/public/') || req.path === '/health') return next();
  res.set('Cache-Control', 'no-store');
  const user = sessionUser(sessionToken(req));
  if (!user)
    return res
      .status(401)
      .json({ code: 'AUTH_REQUIRED', error: 'Inicia sesión para acceder a la consola.' });
  req.admin = user;
  next();
}
export function registerRoutes(app) {
  app.use('/api/auth', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/auth/session', (req, res) => res.json({ user: sessionUser(sessionToken(req)) }));
  app.post('/api/auth/login', limitRequests({ max: 10, windowMs: 60000 }), async (req, res) => {
    const { username, password } = credentials.parse(req.body);
    const user = await authenticate(username, password);
    const token = createSession(user, sessionToken(req));
    res.cookie(COOKIE_NAME, token, { ...cookieOptions(req), maxAge: SESSION_DURATION });
    res.json({ user });
  });
  app.post('/api/auth/logout', (req, res) => {
    endSession(sessionToken(req));
    res.clearCookie(COOKIE_NAME, cookieOptions(req));
    res.json({ loggedOut: true });
  });
}
