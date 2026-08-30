import { validateApiKey } from "../../hooks/validateApiKey.ts";

async function authRoutes (fastify) {
  
  fastify.post('/', async (request, reply) => {
    const { response } = await fastify.pg.query('INSERT INTO users (is_valid) VALUES (true)');
    return response;
  })

  fastify.put('/', async (request, reply) => {
    const apiKey = request.headers.authorization;
    await validateApiKey(request, reply);

    //Genereate a new API key for the user and return it
    const { rows } = await fastify.pg.query(
      `UPDATE users
      SET api_key = gen_random_uuid()
      WHERE api_key = $1
      RETURNING api_key`, [apiKey]
    );
    
    return rows;
  })
}

export default authRoutes;