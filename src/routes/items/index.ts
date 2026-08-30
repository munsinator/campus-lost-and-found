import { validateApiKey } from "../../hooks/validateApiKey.ts";

async function itemRoutes (fastify) {

  fastify.get('/', async (request, reply) => {
    const { rows } = await fastify.pg.query('SELECT * from items');
    return rows;
  });

  fastify.post('/', async (request, reply) => {
    await validateApiKey(request, reply);
    const { body } = request.body;

    const { rows } = await fastify.pg.query('INSERT INTO items (author, name, description, date) VALUES ($1, $2, $3, $4)', [body.userId, body.name, body.description, body.date]);
    return rows;
  });

  fastify.get('/:itemId', async (request, reply) => {
    const { itemId } = request.params;
    const { rows } = await fastify.pg.query('SELECT * from items WHERE item_id=$1', [itemId]);
    return rows;
  });

  fastify.put('/:itemId', async (request, reply) => {
    await validateApiKey(request, reply);

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

    return rows;
  })

  fastify.delete('/:itemId', async (request, reply) => {
    await validateApiKey(request, reply);
    const { user } = request.body;
    const { itemId } = request.params;
    const { rows } = await fastify.pg.query(
      `DELETE FROM items
      WHERE item_id = $1
        AND user_id = $2
      RETURNING *`,
      [itemId, user.user_id]
    );
    return rows;
  })
}

export default itemRoutes;