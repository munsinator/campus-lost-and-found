import { jest } from '@jest/globals';
import { hashApiKey } from '../utils/apiKey.ts';

// Replace PostHog before importing the server: tests never contact PostHog.
const isEnabled = jest.fn();
const evaluateFlags = jest.fn();
jest.unstable_mockModule('../utils/posthog.ts', () => ({
  posthog: { evaluateFlags }
}));
const { buildFastifyInstance } = await import('../server.ts');

const itemId = 'c4434702-1267-4f51-afb4-7180e1348489';
const userId = 'a4434702-1267-4f51-afb4-7180e1348489';
const headers = { authorization: 'test-api-key' };
const itemBody = {
  name: 'Umbrella',
  description: 'Blue umbrella in the library',
  date: '2026-09-09'
};
const item = { item_id: itemId, author: userId, ...itemBody };
let app;
let query;

beforeEach(async () => {
  isEnabled.mockReset().mockReturnValue(true);
  evaluateFlags.mockReset().mockResolvedValue({ isEnabled });
  app = buildFastifyInstance();
  await app.ready();
  // The pool connects only on a query. Replace query before any requests.
  query = jest.spyOn(app.pg, 'query').mockResolvedValue({ rows: [] });
});

afterEach(async () => {
  await app.close();
  jest.restoreAllMocks();
});

test('creates a key and sends only its hash to the database', async () => {
  query.mockResolvedValueOnce({ rows: [{ user_id: userId }] });
  const response = await app.inject({ method: 'POST', url: '/auth/' });
  const body = response.json();
  expect(response.statusCode).toBe(201);
  expect(body.userId).toBe(userId);
  expect(body.apiKey).toMatch(/^[a-f0-9]{64}$/);
  expect(query).toHaveBeenCalledWith(expect.any(String), [hashApiKey(body.apiKey)]);
});

test('rotation rejects a missing key without querying the database', async () => {
  const response = await app.inject({ method: 'PUT', url: '/auth/' });
  expect(response.statusCode).toBe(401);
  expect(query).not.toHaveBeenCalled();
});

test('rotation rejects an unknown key', async () => {
  const response = await app.inject({ method: 'PUT', url: '/auth/', headers });
  expect(response.statusCode).toBe(401);
  expect(response.json()).toEqual({ error: 'Invalid API key' });
});

test('rotation returns a new key and passes both hashes to the database', async () => {
  query.mockResolvedValueOnce({ rows: [{ user_id: userId }] });
  const response = await app.inject({ method: 'PUT', url: '/auth/', headers });
  const body = response.json();
  expect(response.statusCode).toBe(200);
  expect(body.apiKey).toMatch(/^[a-f0-9]{64}$/);
  expect(body.apiKey).not.toBe(headers.authorization);
  expect(query).toHaveBeenCalledWith(expect.any(String), [
    hashApiKey(body.apiKey), hashApiKey(headers.authorization)
  ]);
});

test('lists items publicly with pagination and oldest-first sorting', async () => {
  query.mockResolvedValueOnce({ rows: [item] });
  const response = await app.inject('/items/?page=2&limit=2&sort=asc');
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual([item]);
  expect(query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY date ASC'), [2, 2]);
});

test('returns an empty public list when there are no items', async () => {
  const response = await app.inject('/items/');
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual([]);
  expect(query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY date DESC'), [10, 0]);
});

test.each(['page=0', 'limit=101', 'sort=invalid'])(
  'rejects invalid list parameters: %s', async (parameters) => {
    const response = await app.inject(`/items/?${parameters}`);
    expect(response.statusCode).toBe(400);
    expect(query).not.toHaveBeenCalled();
  }
);

test('applies parameterized search when the flag is enabled', async () => {
  const response = await app.inject('/items/?search=umbrella');
  expect(response.statusCode).toBe(200);
  expect(isEnabled).toHaveBeenCalledWith('item-search');
  expect(query).toHaveBeenCalledWith(expect.stringContaining('ILIKE $3'), [10, 0, '%umbrella%']);
});

test('omits the search filter when the flag is disabled', async () => {
  isEnabled.mockReturnValue(false);
  query.mockResolvedValueOnce({ rows: [item] });
  const response = await app.inject('/items/?search=nomatch');
  expect(response.json()).toEqual([item]);
  expect(query).toHaveBeenCalledWith(expect.not.stringContaining('ILIKE'), [10, 0]);
});

test('reads a single item publicly', async () => {
  query.mockResolvedValueOnce({ rows: [item] });
  const response = await app.inject(`/items/${itemId}`);
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual(item);
});

test('returns 404 for an absent item', async () => {
  const response = await app.inject(`/items/${itemId}`);
  expect(response.statusCode).toBe(404);
});

test.each(['GET', 'PUT', 'DELETE'])(
  '%s rejects malformed item IDs before any database query', async (method) => {
    const response = await app.inject({
      method, url: '/items/not-a-uuid', headers,
      ...(method === 'PUT' ? { payload: itemBody } : {})
    });
    expect(response.statusCode).toBe(400);
    expect(query).not.toHaveBeenCalled();
  }
);

test.each(['POST', 'PUT', 'DELETE'])(
  '%s rejects writes without authentication', async (method) => {
    const response = await app.inject({
      method, url: method === 'POST' ? '/items/' : `/items/${itemId}`,
      ...(method !== 'DELETE' ? { payload: itemBody } : {})
    });
    expect(response.statusCode).toBe(401);
    expect(query).not.toHaveBeenCalled();
  }
);

test.each(['POST', 'PUT', 'DELETE'])(
  '%s stops after an invalid key instead of writing data', async (method) => {
    const response = await app.inject({
      method, url: method === 'POST' ? '/items/' : `/items/${itemId}`, headers,
      ...(method !== 'DELETE' ? { payload: itemBody } : {})
    });
    expect(response.statusCode).toBe(401);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT user_id'), [hashApiKey(headers.authorization)]);
  }
);

test.each([
  { description: 'Missing name', date: '2026-09-09' },
  { ...itemBody, name: '' },
  { ...itemBody, date: 'not-a-date' }
])('rejects invalid creation body: %j', async (payload) => {
  const response = await app.inject({ method: 'POST', url: '/items/', headers, payload });
  expect(response.statusCode).toBe(400);
  expect(query).not.toHaveBeenCalled();
});

test('creates an item using the authenticated user, not a supplied user ID', async () => {
  query.mockResolvedValueOnce({ rows: [{ user_id: userId }] })
    .mockResolvedValueOnce({ rows: [item] });
  const response = await app.inject({
    method: 'POST', url: '/items/', headers,
    payload: { ...itemBody, userId: 'someone-else' }
  });
  expect(response.statusCode).toBe(201);
  expect(response.json()).toEqual(item);
  expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO items'),
    [userId, itemBody.name, itemBody.description, itemBody.date]);
});

test('accepts an update containing only a description', async () => {
  const updated = { ...item, description: 'At reception' };
  query.mockResolvedValueOnce({ rows: [{ user_id: userId }] })
    .mockResolvedValueOnce({ rows: [updated] });
  const response = await app.inject({
    method: 'PUT', url: `/items/${itemId}`, headers,
    payload: { description: 'At reception' }
  });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual(updated);
  expect(query).toHaveBeenNthCalledWith(2, expect.any(String), [null, 'At reception', null, itemId]);
});

test('rejects an empty update body', async () => {
  const response = await app.inject({ method: 'PUT', url: `/items/${itemId}`, headers, payload: {} });
  expect(response.statusCode).toBe(400);
  expect(query).not.toHaveBeenCalled();
});

test.each(['PUT', 'DELETE'])('%s returns 404 for a missing item', async (method) => {
  query.mockResolvedValueOnce({ rows: [{ user_id: userId }] });
  const response = await app.inject({
    method, url: `/items/${itemId}`, headers,
    ...(method === 'PUT' ? { payload: itemBody } : {})
  });
  expect(response.statusCode).toBe(404);
  expect(response.json()).toEqual({ error: 'Item not found' });
});

test('deletes an item and returns an empty 204 response', async () => {
  query.mockResolvedValueOnce({ rows: [{ user_id: userId }] })
    .mockResolvedValueOnce({ rows: [{ item_id: itemId }] });
  const response = await app.inject({ method: 'DELETE', url: `/items/${itemId}`, headers });
  expect(response.statusCode).toBe(204);
  expect(response.body).toBe('');
  expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining('DELETE FROM items'), [itemId]);
});
