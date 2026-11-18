CREATE TABLE atelier_products (id text PRIMARY KEY, data jsonb NOT NULL);
CREATE TABLE atelier_customers (
 id uuid PRIMARY KEY,
 username text UNIQUE,
 password_hash text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((username IS NULL) = (password_hash IS NULL))
);
CREATE TABLE atelier_sessions (
 token_hash text PRIMARY KEY,
 owner_id uuid NOT NULL REFERENCES atelier_customers(id),
 expires_at timestamptz NOT NULL
);
CREATE INDEX atelier_sessions_owner ON atelier_sessions(owner_id);
CREATE TABLE atelier_carts (
 owner_id uuid PRIMARY KEY REFERENCES atelier_customers(id),
 state jsonb NOT NULL DEFAULT '{"lines":[],"savedIds":[]}',
 version integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE atelier_orders ADD COLUMN status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled'));
ALTER TABLE atelier_orders ADD COLUMN cancelled_at timestamptz;
CREATE TABLE atelier_order_events (
 id uuid PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES atelier_orders(id),
 event text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX atelier_events_order ON atelier_order_events(order_id,created_at);
INSERT INTO atelier_products(id,data) VALUES ('arc','{"id": "arc", "name": "Arc Signet", "category": "Rings", "material": "Gold vermeil", "price": 4200, "image": "arc.webp", "variants": ["Size 5", "Size 6", "Size 7", "Size 8"], "description": "A softly sculpted signet with a low-profile oval face and rounded edges.", "finish": "Mirror polish"}'::jsonb);
INSERT INTO atelier_products(id,data) VALUES ('form','{"id": "form", "name": "Form Huggies", "category": "Earrings", "material": "Gold vermeil", "price": 3600, "image": "form.webp", "variants": ["One size"], "description": "Small polished hoops with an asymmetric outline and hinged clasp.", "finish": "High polish"}'::jsonb);
INSERT INTO atelier_products(id,data) VALUES ('tide','{"id": "tide", "name": "Tide Pendant", "category": "Necklaces", "material": "Gold vermeil and freshwater pearl", "price": 5100, "image": "tide.webp", "variants": ["40 cm", "45 cm"], "description": "An irregular freshwater pearl suspended on a fine chain.", "finish": "Pearl and smooth gold"}'::jsonb);
INSERT INTO atelier_products(id,data) VALUES ('duo','{"id": "duo", "name": "Duo Band", "category": "Rings", "material": "Gold vermeil", "price": 3400, "image": "duo.webp", "variants": ["Size 5", "Size 6", "Size 7", "Size 8"], "description": "Two rounded bands joined at the base, leaving an open line around the finger.", "finish": "High polish"}'::jsonb);
INSERT INTO atelier_products(id,data) VALUES ('drop','{"id": "drop", "name": "Cove Drops", "category": "Earrings", "material": "Gold vermeil and freshwater pearl", "price": 4800, "image": "drop.webp", "variants": ["One size"], "description": "A pair of freshwater pearl drops on fine gold hooks with a short, easy profile.", "finish": "Pearl and smooth gold"}'::jsonb);
INSERT INTO atelier_products(id,data) VALUES ('sol','{"id": "sol", "name": "Sol Medallion", "category": "Necklaces", "material": "Gold vermeil", "price": 5600, "image": "sol.webp", "variants": ["40 cm", "45 cm", "50 cm"], "description": "A ridged sunburst pendant on a slim chain with three length options.", "finish": "Textured gold"}'::jsonb);
