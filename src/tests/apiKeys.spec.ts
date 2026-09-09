import { jest } from '@jest/globals';
import { generateApiKey, hashApiKey, validateApiKey } from '../utils/apiKey.ts';

test('accepts a valid key and attaches the authenticated user ID', async () => {
  const key = generateApiKey();
  const request = {
    headers: { authorization: key },
    server: {
      pg: { query: jest.fn().mockResolvedValue({ rows: [{ user_id: 'test-user' }] }) }
    }
  };
  const reply = { code: jest.fn().mockReturnThis(), send: jest.fn() };

  await validateApiKey(request, reply);

  expect(request).toHaveProperty('userId', 'test-user');
  expect(request.server.pg.query).toHaveBeenCalledWith(expect.any(String), [hashApiKey(key)]);
  expect(reply.send).not.toHaveBeenCalled();
});

test('generates a 64-character hexadecimal API key', () => {
  const key = generateApiKey();

  expect(key).toMatch(/^[a-f0-9]{64}$/);
});

test('generates different API keys', () => {
  expect(generateApiKey()).not.toBe(generateApiKey());
});

test('hashes the same key consistently', () => {
  const key = generateApiKey();

  expect(hashApiKey(key)).toBe(hashApiKey(key));
});

test('does not store the plaintext key as its hash', () => {
  const key = generateApiKey();

  expect(hashApiKey(key)).not.toBe(key);
});

test('rejects a request without an API key', async () => {
  const request = {
    headers: {},
    server: {
      pg: {
        query: jest.fn()
      }
    }
  };

  const reply = {
    code: jest.fn().mockReturnThis(),
    send: jest.fn()
  };

  await validateApiKey(request, reply);

  expect(reply.code).toHaveBeenCalledWith(401);
  expect(reply.send).toHaveBeenCalledWith({
    error: 'API key missing'
  });
  expect(request.server.pg.query).not.toHaveBeenCalled();
});

test('rejects an API key that is not in the database', async () => {
  const request = {
    headers: {
      authorization: 'invalid-key'
    },
    server: {
      pg: {
        query: jest.fn().mockResolvedValue({ rows: [] })
      }
    }
  };

  const reply = {
    code: jest.fn().mockReturnThis(),
    send: jest.fn()
  };

  await validateApiKey(request, reply);

  expect(reply.code).toHaveBeenCalledWith(401);
  expect(reply.send).toHaveBeenCalledWith({
    error: 'Invalid API key'
  });
  expect(request).not.toHaveProperty('userId');
});
