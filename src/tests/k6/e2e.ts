import http from 'k6/http';
import { check, fail } from 'k6';
import type { Options } from 'k6/options';

export const options: Options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate==1'] }
};

// Stoppen, wenn ein notwendiger Schritt fehlschlaegt.
function expectStatus(response, status: number, message: string): void {
  if (!check(response, { [message]: (r) => r.status === status })) {
    fail(message);
  }
}

export default function e2eTest(): void {
  const base = __ENV.BASE_URL;
  const searchEnabled = __ENV.SEARCH_ENABLED;
  if (!base || !['true', 'false'].includes(searchEnabled)) {
    fail('BASE_URL und SEARCH_ENABLED=true oder false angeben');
  }

  // 1. Key erstellen und rotieren.
  const registration = http.post(`${base}/auth/`);
  expectStatus(registration, 201, 'API-Key erstellen: 201');
  const oldKey = registration.json('apiKey') as string;
  const rotation = http.put(`${base}/auth/`, null, {
    headers: { Authorization: oldKey }
  });
  expectStatus(rotation, 200, 'API-Key rotieren: 200');
  const key = rotation.json('apiKey') as string;
  check(key, { 'neuer Key unterscheidet sich': (value) => !!value && value !== oldKey });

  const headers = { Authorization: key, 'Content-Type': 'application/json' };
  const marker = `k6-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const body = JSON.stringify({ name: marker, description: 'E2E Testgegenstand', date: '2026-09-10' });

  // 2. Eigenen Testgegenstand erstellen; im finally-Block wieder entfernen.
  const created = http.post(`${base}/items/`, body, { headers });
  expectStatus(created, 201, 'Item erstellen: 201');
  const itemId = created.json('item_id') as string;
  if (!itemId) fail('Item-ID fehlt');

  try {
    // 3. Ohne Key lesen, mit neuem Key bearbeiten.
    const read = http.get(`${base}/items/${itemId}`);
    expectStatus(read, 200, 'Item oeffentlich lesen: 200');
    check(read, { 'gespeicherter Name stimmt': (r) => r.json('name') === marker });

    const updated = http.put(`${base}/items/${itemId}`, JSON.stringify({ description: 'Bearbeitet' }), { headers });
    expectStatus(updated, 200, 'Item bearbeiten: 200');
    const reread = http.get(`${base}/items/${itemId}`);
    expectStatus(reread, 200, 'Bearbeitetes Item lesen: 200');
    check(reread, { 'Aenderung gespeichert': (r) => r.json('description') === 'Bearbeitet' });

    // 4. Fehlender und alter Key duerfen nicht schreiben.
    expectStatus(http.put(`${base}/items/${itemId}`, body, {
      headers: { 'Content-Type': 'application/json' }
    }), 401, 'Schreiben ohne Key abgelehnt: 401');
    expectStatus(http.put(`${base}/items/${itemId}`, body, {
      headers: { Authorization: oldKey, 'Content-Type': 'application/json' }
    }), 401, 'Alter Key ungueltig: 401');

    // 5. Flag an: eigener Treffer + keine Treffer fuer einen unbekannten Begriff.
    // Flag aus: der unbekannte Suchbegriff wird ignoriert, die Liste bleibt gefuellt.
    const search = http.get(`${base}/items/?search=${marker}`);
    expectStatus(search, 200, 'Suche antwortet: 200');
    if (searchEnabled === 'true') {
      check(search, {
        'Suche findet genau das Testitem': (r) => {
          const items = r.json() as Array<{ item_id: string }>;
          return Array.isArray(items) && items.length === 1 && items[0].item_id === itemId;
        }
      });
    }
    const missing = http.get(`${base}/items/?search=missing-${marker}`);
    expectStatus(missing, 200, 'Suche nach unbekanntem Begriff: 200');
    check(missing, {
      'Suchverhalten entspricht dem Feature Flag': (r) => {
        const items = r.json() as unknown[];
        return Array.isArray(items) && (searchEnabled === 'true' ? items.length === 0 : items.length > 0);
      }
    });
  } finally {
    // Nur unseren eigenen Gegenstand loeschen, auch nach einem Testfehler.
    expectStatus(http.del(`${base}/items/${itemId}`, null, { headers }), 204, 'Testitem loeschen: 204');
  }

  expectStatus(http.get(`${base}/items/${itemId}`), 404, 'Geloeschtes Item nicht mehr vorhanden: 404');
}
