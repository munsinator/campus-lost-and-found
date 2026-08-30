CREATE TABLE users (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key uuid gen_random_uuid(),
  is_valid BOOLEAN
);

CREATE TABLE items (
  item_id uuid DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description VARCHAR(255) NOT NULL,
  date DATE NOT NULL, /* 2026-08-29 */ 
  CONSTRAINT fk_user_id FOREIGN KEY(author) REFERENCES users(user_id)
);
