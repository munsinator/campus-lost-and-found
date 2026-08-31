import Fastify from "fastify";
import Postgres from "@fastify/postgres";

import authRoutes from './routes/auth/index.ts';
import itemRoutes from './routes/items/index.ts';

//Added (pretty) logger to fastify instance
const fastify = Fastify({
    logger: {
        transport:{
            target: "pino-pretty"
        }
    }
});

fastify.register(Postgres, {  

    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
        rejectUnauthorized: false
    } 
});

fastify.register(authRoutes, { prefix: '/auth'});
fastify.register(itemRoutes, { prefix: '/items'});

//To start the server -> server.listen() + port
async function start() {
    await fastify.listen({
        port:3000,
        host: '0.0.0.0'
    })
}

start();

