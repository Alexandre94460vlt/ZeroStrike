import { test, expect } from '@playwright/test';

test.describe('Hub & pages statiques', () => {
  test('GET / — hub HTML avec liens Grand écran / Manette', async ({ request }) => {
    const res = await request.get('/');
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/text\/html/i);
    const html = await res.text();
    expect(html).toMatch(/<title>Zero Strike<\/title>/i);
    expect(html).toMatch(/href="\/display"/);
    expect(html).toMatch(/href="\/mobile"/);
    expect(html).toMatch(/Grand écran/);
    expect(html).toMatch(/Manette/);
  });

  test('GET /display — 200 (bundle Phaser servi)', async ({ request }) => {
    const res = await request.get('/display');
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/text\/html/i);
  });
});
