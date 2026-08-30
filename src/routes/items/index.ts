async function itemRoutes (fastify, options) {

  fastify.get('/', async (request, reply) => {
    const { rows } = await fastify.pg.query('SELECT * from items')
    return rows
  })

  fastify.post('/', async (request, reply) => {
    const apiKey = request.headers['Authorization'];

  })

  fastify.get('/:itemId', async (request, reply) => {
    const { itemId } = request.params;

  })

  fastify.put('/:itemId', async (request, reply) => {
    const apiKey = request.headers['Authorization'];
    const { itemId } = request.params;

  })

  fastify.delete('/:itemId', async (request, reply) => {
    const apiKey = request.headers['Authorization'];
    const { itemId } = request.params;

  })
}

export default itemRoutes;