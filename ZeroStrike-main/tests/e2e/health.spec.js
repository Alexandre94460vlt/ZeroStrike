import { test, expect } from '@playwright/test';

test('GET /health — service joignable', async ({ request }) => {
  const res = await request.get('/health');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({ ok: true, service: 'zero-strike' });
});
