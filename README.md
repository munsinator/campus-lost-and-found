# Campus Lost-and-Found API

## Start with Docker Compose

1. Install and start Docker Desktop. Have a reachable PostgreSQL database ready.
2. For a new, empty database, run `src/database/init.sql` in your SQL editor. Compose does not run this file automatically. For an existing database, check that `users` contains `user_id`, `api_key_hash` (text), and `is_valid`; changing the SQL file does not update existing tables.
3. Create a `.env` file in the project root with your database settings:

   ```env
   DB_HOST=your_database_address
   DB_PORT=5432
   DB_NAME=your_database_name
   DB_USER=your_database_user
   DB_PASSWORD=your_database_password
   ```

   Use the RDS endpoint for an AWS database. For PostgreSQL running on your computer, Docker Desktop uses `host.docker.internal` instead of `localhost`. The current server configuration requires database SSL; a local database must support it or the SSL configuration must be adjusted for local use. Keep actual credentials out of Git.

4. Run from the project root:

   ```bash
   docker compose up -d --build --force-recreate backend
   ```

5. The API is available at `http://localhost:3000`. To inspect errors:

   ```bash
   docker compose logs --tail=50 backend
   ```

Compose reads `.env` through `env_file` and passes the variables into the container. The Node.js app reads them through `process.env`. The current code uses the separate `DB_*` variables, not `DB_URL`. Recreate the container after changing these settings.

## Create the first API key

1. In Postman, send `POST http://localhost:3000/auth/` with no body and no Authorization header. This route currently allows public key creation.
2. Expect `201 Created`:

   ```json
   {
     "userId": "generated-user-id",
     "apiKey": "generated-secret-key"
   }
   ```

3. Save the key privately. The application generates a random key and stores only its SHA-256 hash in `users.api_key_hash`. The plaintext key is returned in this response and cannot be retrieved from the database later.

## Rotate an API key

1. Send `PUT http://localhost:3000/auth/` with no body.
2. In the Headers tab, set `Authorization` to your current key directly, without a `Bearer` prefix.
3. Expect `200 OK`:

   ```json
   {
     "message": "API key rotated",
     "apiKey": "new-generated-secret-key"
   }
   ```

4. Save the new key. Its hash replaces the old hash, so the old key is immediately invalid.

Use the same Authorization header with your current key for POST, PUT, and DELETE requests to `/items` routes. Reading items does not require a key.

## Manual API-key checks

Perform these checks in order in Postman:

| Request | Authorization header | Expected result |
| --- | --- | --- |
| `POST /auth/` | None | `201`, returns the first key |
| `PUT /auth/` | First key | `200`, returns a new key |
| `PUT /auth/` | First key again | `401`, `Invalid API key` |
| `PUT /auth/` | None | `401`, `API key missing` |
| `PUT /auth/` | New key | `200`, returns another new key |

Every successful rotation changes the key. Always keep the most recently returned key. These manual checks do not replace the automated Jest tests required for the project.
