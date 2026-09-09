import { generateApiKey, hashApiKey } from "../../utils/apiKey.ts";

async function authRoutes (fastify) {
  
  fastify.post('/', async (request, reply) => {
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);

    const { rows } = await fastify.pg.query(
      `INSERT INTO users (api_key_hash, is_valid)
      VALUES ($1, true)
      RETURNING user_id`,
      [apiKeyHash]
    );

    return reply.code(201).send({
      userId: rows[0].user_id,
      apiKey
    });
  })

  fastify.put('/', async (request, reply) => {
    const oldApiKey = request.headers.authorization;

    if (!oldApiKey) {
      return reply.code(401).send({ error: 'API key missing' });
    }

    const newApiKey = generateApiKey();

    const { rows } = await fastify.pg.query(
      `UPDATE users
      SET api_key_hash = $1
      WHERE api_key_hash = $2
      AND is_valid = true
      RETURNING user_id`,
      [hashApiKey(newApiKey), hashApiKey(oldApiKey)]
    );

    if (rows.length === 0) {
      return reply.code(401).send({ error: 'Invalid API key' });
    }

    return reply.send({
      message: 'API key rotated',
      apiKey: newApiKey
    });
  });
}

export default authRoutes;