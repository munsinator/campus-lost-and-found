import { validateApiKey } from "../../utils/apiKey.ts";
import { posthog } from '../../utils/posthog.ts';

async function itemRoutes (fastify) {
  fastify.decorateRequest('userId', null); //To have a place to store the authenticated user's ID with each request

  fastify.get('/', { 
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
          sort: {
            type: 'string',
            enum: ['desc', 'asc'],
            default: 'desc'
          },
          search: { type: 'string', minLength: 1, maxLength: 255 }
        }
      }
    }
  }, async (request, reply) => {
    const { page, limit, sort, search } = request.query;
    const offset = (page - 1) * limit;

    const direction = sort === 'asc' ? 'ASC' : 'DESC';
    const orderBy = `ORDER BY date ${direction}, item_id ASC`;
    let searchCondition = '';
    const values = [limit, offset];

    if (typeof search === 'string' && search.trim() !== '') {
      const searchText = search.trim();

      const flags = await posthog.evaluateFlags('public-api', {
        sendFeatureFlagEvents: false
      });

      if (flags.isEnabled('item-search')) {
        searchCondition = 'WHERE (name ILIKE $3 OR description ILIKE $3)';
        values.push(`%${searchText}%`);
      }
    }

    const { rows } = await fastify.pg.query(
      `SELECT * FROM items
      ${searchCondition}
      ${orderBy}
      LIMIT $1 OFFSET $2`,
      values
    );

    return rows;
  });

  fastify.post('/', { preHandler: validateApiKey, 
    schema: {
      body: {
        type: 'object',
        required: ['name', 'description', 'date'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string', minLength: 1, maxLength: 255 },
          date: { type: 'string', format: 'date' }
        }
      }} 
    }, async (request, reply) => {
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

  fastify.get('/:itemId', {
  schema: {
    params: {
      type: 'object',
      required: ['itemId'],
      properties: {
        itemId: { type: 'string', format: 'uuid' }
      }
    }
  }
  },async (request, reply) => {
    const { itemId } = request.params;
    const { rows } = await fastify.pg.query('SELECT * from items WHERE item_id=$1', [itemId]);
    
    if (rows.length === 0) {
      return reply.code(404).send({ error: 'Item not found' });
    }

    return reply.send(rows[0]); 
  });

  fastify.put('/:itemId', { preHandler: validateApiKey,
  schema: {
    params: {
      type: 'object',
      required: ['itemId'],
      properties: {
        itemId: { type: 'string', format: 'uuid' }
      }
    },
    body: {
      type: 'object',
      minProperties: 1,
      additionalProperties: false,
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 255 },
        description: { type: 'string', minLength: 1, maxLength: 255 },
        date: { type: 'string', format: 'date' }
      }
    }
  }
}, async (request, reply) => {
  const { itemId } = request.params;
  const { name, description, date } = request.body;

    const { rows } = await fastify.pg.query(
    `UPDATE items
    SET name = COALESCE($1, name),
        description = COALESCE($2, description),
        date = COALESCE($3, date),
        updated_at = NOW()
    WHERE item_id = $4
    RETURNING *`,
    [name ?? null, description ?? null, date ?? null, itemId]
  );

  if (rows.length === 0) {
    return reply.code(404).send({ error: 'Item not found' });
  }

  return reply.send(rows[0]);
});

  fastify.delete('/:itemId', { preHandler: validateApiKey, 
    schema: {
      params: {
        type: 'object',
        required: ['itemId'],
        properties: {
          itemId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
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