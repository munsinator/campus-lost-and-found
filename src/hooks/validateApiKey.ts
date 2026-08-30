export async function validateApiKey(request, reply) {
  const apiKey = request.headers.authorization;

  if (!apiKey) {
    return reply.code(401).send({
      error: 'API key missing'
    });
  }

  const { rows } = await request.server.pg.query(
    `SELECT * FROM users
     WHERE api_key = $1
     AND is_valid = true`,
    [apiKey]
  );

  if (rows.length === 0) {
    return reply.code(401).send({
      error: 'Invalid API key'
    });
  }
}