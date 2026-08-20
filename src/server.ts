import Fastify from "fastify";
//import routes from 'routes/routes';

//Added (pretty) logger to fastify instance
const fastify = Fastify({
    logger: {
        transport:{
            target: "pino-pretty"
        }
    }
});

//fastify.register(routes)

//To start the server -> server.listen() + port
async function start() {
    await fastify.listen({
        port:3000
    })
}

start();

