import assert from 'node:assert/strict';
export async function loginAdmin(base) {
  const response = await fetch(new URL('/api/auth/login', base), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'password' }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  return (url, options = {}) => {
    const headers = new Headers(options.headers);
    headers.set('Cookie', cookie);
    return fetch(url, { ...options, headers });
  };
}
