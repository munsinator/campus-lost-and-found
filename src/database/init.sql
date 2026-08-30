CREATE TABLE users (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key uuid DEFAULT gen_random_uuid(),
  is_valid BOOLEAN
);

CREATE TABLE items (
  item_id uuid DEFAULT gen_random_uuid(),
  author uuid NOT NULL,
  name VARCHAR(255) NOT NULL,
  description VARCHAR(255) NOT NULL,
  date DATE NOT NULL, 
  CONSTRAINT fk_user_id FOREIGN KEY(author) REFERENCES users(user_id) ON DELETE CASCADE
);
