import { createHash } from 'node:crypto';
import { welcomeTemplate } from './welcome-rules.mjs';

const cache = new Map();

export async function welcomeApproved(
  config,
  { fetcher = fetch, now = Date.now(), force = false } = {},
) {
  const template = welcomeTemplate(config);
  if (!template || !config.businessAccountId || !config.token) return false;
  const key = [
    config.businessAccountId,
    template.name,
    template.language,
    createHash('sha256').update(config.token).digest('hex'),
  ].join('|');
  const previous = cache.get(key);
  if (!force && previous && previous.until > now) return previous.approved;
  let approved = false;
  try {
    const url = new URL(
      `https://graph.facebook.com/${config.apiVersion}/${config.businessAccountId}/message_templates`,
    );
    url.searchParams.set('name', template.name);
    url.searchParams.set('fields', 'name,language,status');
    const response = await fetcher(url, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(10000),
    });
    const body = await response.json();
    approved =
      response.ok &&
      (body.data ?? []).some(
        (item) =>
          item.name === template.name &&
          item.language === template.language &&
          item.status === 'APPROVED',
      );
  } catch (error) {
    console.error('No se pudo comprobar la aprobación de la bienvenida en Meta:', error.message);
  }
  cache.set(key, { approved, until: now + 60000 });
  return approved;
}
