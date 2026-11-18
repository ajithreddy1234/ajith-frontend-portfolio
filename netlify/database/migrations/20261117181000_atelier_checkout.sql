CREATE TABLE atelier_inventory (
  product_id text NOT NULL,
  variant text NOT NULL,
  stock integer NOT NULL CHECK (stock >= 0),
  PRIMARY KEY (product_id, variant)
);

CREATE TABLE atelier_orders (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL,
  request_id uuid NOT NULL,
  delivery text NOT NULL CHECK (delivery IN ('standard', 'express')),
  shipping integer NOT NULL CHECK (shipping >= 0),
  total integer NOT NULL CHECK (total >= shipping),
  lines jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, request_id)
);

CREATE INDEX atelier_orders_by_session ON atelier_orders (session_id, created_at DESC);

INSERT INTO atelier_inventory (product_id, variant, stock) VALUES
  ('arc', 'Size 5', 18), ('arc', 'Size 6', 36), ('arc', 'Size 7', 30), ('arc', 'Size 8', 19),
  ('form', 'One size', 45),
  ('tide', '40 cm', 24), ('tide', '45 cm', 32),
  ('duo', 'Size 5', 20), ('duo', 'Size 6', 36), ('duo', 'Size 7', 30), ('duo', 'Size 8', 24),
  ('drop', 'One size', 39),
  ('sol', '40 cm', 26), ('sol', '45 cm', 33), ('sol', '50 cm', 18);
