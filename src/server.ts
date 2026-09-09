import Fastify from "fastify";
import Postgres from "@fastify/postgres";
import { pathToFileURL } from 'node:url';
import authRoutes from './routes/auth/index.ts';
import itemRoutes from './routes/items/index.ts';

//Added (pretty) logger to fastify instance
export function buildFastifyInstance() {
    const fastify = Fastify({
        logger: process.env.NODE_ENV === 'test' ? false : {
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
    return fastify;
}

//To start the server -> server.listen() + port

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href){
    const app = buildFastifyInstance();

    await app.listen({
        port: 3000,
        host: '0.0.0.0'
    });    
}
