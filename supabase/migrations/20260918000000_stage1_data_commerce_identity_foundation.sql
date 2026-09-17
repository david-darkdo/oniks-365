-- ==============================================================================
-- ONIKS 365 - BUILD ONE: DATA & COMMERCE FOUNDATION + IDENTITY PURIFICATION
-- Target Project: ONIKS 365 (zmjkxqyjkmoctdbmrjjg)
-- Safe, idempotent migration with constraints, unique indexes, backfills, & RPCs
-- ==============================================================================

-- 1. ADD COMMERCE & IDENTITY COLUMNS TO public.products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS original_price numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pricing_unit text DEFAULT 'piece',
  ADD COLUMN IF NOT EXISTS differentiator_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS differentiator_note text DEFAULT NULL;

-- 2. ADD SAFETY CHECK CONSTRAINTS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_pricing_unit'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_pricing_unit
      CHECK (pricing_unit IN ('sqm', 'piece', 'set', 'carton', 'box', 'metre', 'roll', 'unit'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_price_non_negative'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_price_non_negative
      CHECK (price IS NULL OR price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_original_price_non_negative'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_original_price_non_negative
      CHECK (original_price IS NULL OR original_price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_differentiator_note_len'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_differentiator_note_len
      CHECK (differentiator_note IS NULL OR length(differentiator_note) <= 80);
  END IF;
END $$;

-- 3. UNIQUE ACTIVE INDEXES ON CODE AND SLUG
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code_unique
  ON public.products (code)
  WHERE code IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug_unique
  ON public.products (slug)
  WHERE slug IS NOT NULL AND deleted_at IS NULL;

-- 4. ONIKS CONCURRENCY-SAFE PRODUCT CODE GENERATOR RPC
CREATE OR REPLACE FUNCTION public.generate_product_code(_type_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _prefix text;
  _next_val bigint;
  _code text;
  _lock_key bigint;
BEGIN
  -- Obtain advisory transaction lock based on type_id hash to eliminate race conditions
  _lock_key := ('x' || substr(md5(_type_id::text), 1, 15))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(_lock_key);

  -- Derive prefix from product type (Kitchen -> KIT, Bath/Toilet -> BAT, Plumbing -> PLU, default -> ON)
  SELECT
    CASE
      WHEN upper(name) LIKE '%KITCHEN%' THEN 'KIT'
      WHEN upper(name) LIKE '%BATH%' OR upper(name) LIKE '%TOILET%' THEN 'BAT'
      WHEN upper(name) LIKE '%PLUMB%' THEN 'PLU'
      ELSE upper(substr(regexp_replace(name, '[^a-zA-Z]', '', 'g'), 1, 3))
    END
  INTO _prefix
  FROM public.product_types
  WHERE id = _type_id;

  IF _prefix IS NULL OR length(_prefix) = 0 THEN
    _prefix := 'GEN';
  END IF;

  -- Find highest sequence number matching ON-[PREFIX]-XXXXXX or EC-[PREFIX]-XXXXXX to guarantee uniqueness
  SELECT COALESCE(MAX(
    CASE
      WHEN code ~ ('^(ON|EC)-' || _prefix || '-[0-9]+$')
      THEN substring(code from '[0-9]+$')::bigint
      ELSE 0
    END
  ), 0) + 1
  INTO _next_val
  FROM public.products
  WHERE code LIKE 'ON-' || _prefix || '-%' OR code LIKE 'EC-' || _prefix || '-%';

  _code := 'ON-' || _prefix || '-' || lpad(_next_val::text, 6, '0');

  -- Ensure loop safety in the astronomical case of collision
  WHILE EXISTS (SELECT 1 FROM public.products WHERE code = _code) LOOP
    _next_val := _next_val + 1;
    _code := 'ON-' || _prefix || '-' || lpad(_next_val::text, 6, '0');
  END LOOP;

  RETURN _code;
END;
$$;

-- 5. IDENTITY & COMMERCE SAFE BACKFILL FOR EXISTING CATALOG
UPDATE public.products p
SET pricing_unit = (
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.id = p.category_id
        AND (c.slug IN ('vanities', 'cabinets', 'sets', 'combos')
             OR lower(c.name) LIKE '%set%'
             OR lower(c.name) LIKE '%vanit%'
             OR lower(c.name) LIKE '%cabinet%')
    ) THEN 'set'
    ELSE 'piece'
  END
)
WHERE p.pricing_unit IS NULL OR p.pricing_unit = 'piece';

-- 6. UNPOLLUTED SEARCH INDEX BUILDER RPC
CREATE OR REPLACE FUNCTION public.rebuild_search_index(target_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  p_record RECORD;
  t_name text := '';
  c_name text := '';
  b_name text := '';
  diff_text text := '';
  built_document text := '';
BEGIN
  SELECT * INTO p_record FROM public.products WHERE id = target_product_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF p_record.type_id IS NOT NULL THEN
    SELECT name INTO t_name FROM public.product_types WHERE id = p_record.type_id;
  END IF;

  IF p_record.category_id IS NOT NULL THEN
    SELECT name INTO c_name FROM public.categories WHERE id = p_record.category_id;
  END IF;

  IF p_record.brand_id IS NOT NULL THEN
    SELECT name INTO b_name FROM public.brands WHERE id = p_record.brand_id;
  END IF;

  -- Build differentiator text without marketing fluff or geographic pollution
  IF p_record.differentiator_type IS NOT NULL OR p_record.differentiator_note IS NOT NULL THEN
    diff_text := concat_ws(' ',
      replace(COALESCE(p_record.differentiator_type, ''), '_', ' '),
      COALESCE(p_record.differentiator_note, '')
    );
  END IF;

  built_document := concat_ws(' ',
    COALESCE(p_record.name, ''),
    COALESCE(p_record.code, ''),
    COALESCE(t_name, ''),
    COALESCE(c_name, ''),
    COALESCE(b_name, ''),
    COALESCE(p_record.pricing_unit, ''),
    diff_text,
    COALESCE(p_record.description, ''),
    COALESCE(p_record.short_description, '')
  );

  INSERT INTO public.product_search_index (
    product_id,
    document,
    tsv,
    updated_at
  )
  VALUES (
    target_product_id,
    built_document,
    to_tsvector('english', built_document),
    now()
  )
  ON CONFLICT (product_id) DO UPDATE SET
    document = EXCLUDED.document,
    tsv = EXCLUDED.tsv,
    updated_at = EXCLUDED.updated_at;
END;
$$;
