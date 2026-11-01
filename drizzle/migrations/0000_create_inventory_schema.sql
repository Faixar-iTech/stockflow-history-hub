CREATE TABLE public.products (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  quantity integer NOT NULL DEFAULT 0,
  reorder_level integer NOT NULL DEFAULT 5,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.stock_movements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  change integer NOT NULL,
  reason text NOT NULL DEFAULT 'Manual adjustment',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX stock_movements_product_idx ON public.stock_movements (product_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
GRANT SELECT, INSERT, DELETE ON public.stock_movements TO anon, authenticated;
GRANT ALL ON public.stock_movements TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inventory is a single-tenant public tool"
  ON public.products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Movements follow the same access"
  ON public.stock_movements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.products (sku, name, category, quantity, reorder_level, unit_price) VALUES
  ('BLT-M8-50', 'M8 Hex Bolt (box of 50)', 'Fasteners', 120, 30, 6.50),
  ('GLV-L-NIT', 'Nitrile Gloves, Large', 'Safety', 8, 15, 12.00),
  ('TPE-48-CLR', 'Packing Tape 48mm Clear', 'Packaging', 64, 20, 2.25);

INSERT INTO public.stock_movements (product_id, change, reason)
SELECT id, quantity, 'Initial stock' FROM public.products;