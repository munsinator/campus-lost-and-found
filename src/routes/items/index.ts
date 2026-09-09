import { validateApiKey } from "../../utils/apiKey.ts";

async function itemRoutes (fastify) {
  fastify.decorateRequest('userId', null); //To have a place to store the authenticated user's ID with each request

  fastify.get('/', async (request, reply) => {
    const { rows } = await fastify.pg.query('SELECT * from items');
    return rows;
  });

  fastify.post('/', { preHandler: validateApiKey }, async (request, reply) => {
    const { name, description, date } = request.body;

    const { rows } = await fastify.pg.query(
      `INSERT INTO items (author, name, description, date)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [request.userId, name, description, date]
    );

    return reply.code(201).send(rows[0]);
  }
);

  fastify.get('/:itemId', async (request, reply) => {
    const { itemId } = request.params;
    const { rows } = await fastify.pg.query('SELECT * from items WHERE item_id=$1', [itemId]);
    return rows;
  });

  fastify.put('/:itemId', { preHandler: validateApiKey }, async (request, reply) => {
    const { itemId } = request.params;
    const { name, description, date } = request.body;

    const { rows } = await fastify.pg.query(
    `UPDATE items
     SET name = $1,
         description = $2,
         date = $3
     WHERE item_id = $4
     RETURNING *`,
    [name, description, date, itemId]
  );

    if (rows.length === 0) {
      return reply.code(404).send({ error: 'Item not found' });
    }

    return reply.send(rows[0]);
  })

  fastify.delete('/:itemId', { preHandler: validateApiKey }, async (request, reply) => {
    const { itemId } = request.params;

    const { rows } = await fastify.pg.query(
      `DELETE FROM items
       WHERE item_id = $1
       RETURNING item_id`,
      [itemId]
    );

    if (rows.length === 0) {
      return reply.code(404).send({ error: 'Item not found' });
    }

    return reply.code(204).send();
  });
}

export default itemRoutes;