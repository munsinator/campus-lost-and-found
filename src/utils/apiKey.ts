import { randomBytes, createHash } from 'node:crypto';

export function generateApiKey() {
  return randomBytes(32).toString('hex');
}

export function hashApiKey(apiKey: string) {
  return createHash('sha256').update(apiKey).digest('hex');
}

export async function validateApiKey(request, reply) {
  const apiKey = request.headers.authorization;

  if (!apiKey) {
    return reply.code(401).send({
      error: 'API key missing'
    });
  }

  const { rows } = await request.server.pg.query(
    `SELECT user_id FROM users
    WHERE api_key_hash = $1
    AND is_valid = true`,
    [hashApiKey(apiKey)]
  );

  if (rows.length === 0) {
    return reply.code(401).send({
      error: 'Invalid API key'
    });
  }

  request.userId = rows[0].user_id;
}