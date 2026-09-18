-- Migration: 20260918000000_stage1_data_commerce_identity_foundation.sql
-- Description: ONIKS 365 Build 1 - Data & Commerce Foundation + Identity Purification
-- Purpose: Establishes two-tier pricing, dynamic pricing units, differentiator metadata,
--          concurrency-safe ON- product code generator, permanent uniqueness constraints,
--          and unpolluted authoritative search indexing.

-- 1. ADD COMMERCE PRICING & DIFFERENTIATOR COLUMNS
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS original_price numeric NULL,
  ADD COLUMN IF NOT EXISTS pricing_unit text NOT NULL DEFAULT 'piece',
  ADD COLUMN IF NOT EXISTS differentiator_type text NULL,
  ADD COLUMN IF NOT EXISTS differentiator_note text NULL;

-- 2. VALIDATION CONSTRAINTS
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS chk_products_pricing_unit;
ALTER TABLE public.products
  ADD CONSTRAINT chk_products_pricing_unit
  CHECK (pricing_unit IN ('sqm', 'piece', 'set', 'carton', 'box', 'metre', 'roll', 'unit'));

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS chk_products_price_non_negative;
ALTER TABLE public.products
  ADD CONSTRAINT chk_products_price_non_negative
  CHECK (price IS NULL OR price >= 0);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS chk_products_original_price_non_negative;
ALTER TABLE public.products
  ADD CONSTRAINT chk_products_original_price_non_negative
  CHECK (original_price IS NULL OR original_price >= 0);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS chk_products_differentiator_note_len;
ALTER TABLE public.products
  ADD CONSTRAINT chk_products_differentiator_note_len
  CHECK (differentiator_note IS NULL OR length(differentiator_note) <= 80);

-- 3. PERMANENT UNIQUE INDEXES FOR PRODUCT CODE AND CANONICAL SLUG
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code_unique 
  ON public.products(code) 
  WHERE code IS NOT NULL AND btrim(code) != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug_unique 
  ON public.products(slug) 
  WHERE slug IS NOT NULL AND btrim(slug) != '' AND deleted_at IS NULL;

-- 4. CONCURRENCY-SAFE ONIKS PRODUCT CODE GENERATOR (ON- NAMESPACE)
CREATE OR REPLACE FUNCTION public.generate_product_code(_type_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_next int;
  v_code text;
BEGIN
  SELECT code_prefix INTO v_prefix FROM public.product_types WHERE id = _type_id;
  IF v_prefix IS NULL OR btrim(v_prefix) = '' THEN 
    v_prefix := 'GEN'; 
  END IF;

  -- Transaction-scoped advisory lock using ONIKS-specific namespace
  PERFORM pg_advisory_xact_lock(hashtext('oniks_code_lock_' || v_prefix));

  -- Look for existing ON- prefixed codes for this type
  SELECT COALESCE(MAX(
    NULLIF(REGEXP_REPLACE(SPLIT_PART(code, '-', 3), '[^0-9]', '', 'g'), '')::int
  ), 0) + 1
    INTO v_next
    FROM public.products
   WHERE code LIKE 'ON-' || v_prefix || '-%';

  v_code := 'ON-' || v_prefix || '-' || LPAD(v_next::text, 6, '0');
  RETURN v_code;
END $$;

GRANT EXECUTE ON FUNCTION public.generate_product_code(uuid) TO authenticated, service_role;

-- Ensure trigger auto-assigns ONIKS code on insert if blank
CREATE OR REPLACE FUNCTION public.products_autocode()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.code IS NULL OR btrim(NEW.code) = '') AND NEW.type_id IS NOT NULL THEN
    NEW.code := public.generate_product_code(NEW.type_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_products_autocode ON public.products;
CREATE TRIGGER trg_products_autocode
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_autocode();

-- 5. SAFE NON-DESTRUCTIVE BACKFILL FOR EXISTING PRODUCTS
-- Sets, full bundles, and items with integrated basins/racks are mapped to 'set'
UPDATE public.products
SET pricing_unit = 'set'
WHERE pricing_unit = 'piece'
  AND (
    name ILIKE '%set%'
    OR name ILIKE '%with standing basin%'
    OR name ILIKE '%with wall-hung basin%'
    OR name ILIKE '%full-option%'
    OR name ILIKE '%plate rack%'
    OR name ILIKE '%tray%'
  );

-- 6. UNPOLLUTED AUTHORITATIVE FULL-TEXT SEARCH INDEX REBUILDER
CREATE OR REPLACE FUNCTION public.rebuild_search_index(_product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE 
  p record; 
  t_name text; 
  c_name text; 
  s_name text; 
  f_name text; 
  ic_name text;
  size_val text; 
  aliases text[]; 
  keywords text[]; 
  master jsonb; 
  combined text;
BEGIN
  SELECT * INTO p FROM public.products WHERE id = _product_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT name INTO t_name FROM public.product_types WHERE id = p.type_id;
  SELECT name INTO c_name FROM public.categories WHERE id = p.category_id;
  SELECT name INTO s_name FROM public.subcategories WHERE id = p.subcategory_id;
  SELECT name INTO f_name FROM public.family_groups WHERE id = p.family_id;
  
  SELECT ic.name INTO ic_name 
    FROM public.product_types pt
    LEFT JOIN public.installation_contexts ic ON ic.id = pt.installation_context_id
   WHERE pt.id = p.type_id;

  size_val := p.size;
  aliases := public.generate_size_aliases(size_val);
  keywords := COALESCE(p.app_keywords, ARRAY[]::text[])
    || COALESCE(p.seo_keywords, ARRAY[]::text[]);

  master := jsonb_build_object(
    'title', p.name, 
    'manufacturer', p.brand,
    'finish', COALESCE(p.finish, p.finish_name),
    'type', t_name, 
    'category', c_name, 
    'subcategory', s_name, 
    'family', f_name,
    'size', size_val, 
    'aliases', to_jsonb(aliases),
    'installation_context', ic_name, 
    'keywords', to_jsonb(keywords),
    'ai_description', p.generated_description,
    'seo_title', p.seo_title, 
    'seo_description', p.seo_description,
    'pricing_unit', p.pricing_unit,
    'differentiator_type', p.differentiator_type,
    'differentiator_note', p.differentiator_note,
    'quality_terms', to_jsonb(ARRAY['luxury','premium','quality','high quality','imported'])
  );

  combined := concat_ws(' ',
    p.name, p.code, p.brand, p.color, p.material, p.finish, p.finish_name,
    p.short_description, p.generated_description, p.seo_title, p.seo_description,
    p.differentiator_note, p.differentiator_type, p.pricing_unit,
    t_name, c_name, s_name, f_name, ic_name, size_val,
    array_to_string(aliases,' '), array_to_string(keywords,' ')
  );

  INSERT INTO public.search_index (
    product_id, 
    normalized_size, 
    search_aliases, 
    combined_search_text, 
    master_document, 
    search_vector, 
    updated_at
  )
  VALUES (
    _product_id, 
    size_val, 
    aliases, 
    combined, 
    master, 
    to_tsvector('english', combined), 
    now()
  )
  ON CONFLICT (product_id) DO UPDATE
    SET normalized_size = EXCLUDED.normalized_size, 
        search_aliases = EXCLUDED.search_aliases,
        combined_search_text = EXCLUDED.combined_search_text, 
        master_document = EXCLUDED.master_document,
        search_vector = EXCLUDED.search_vector, 
        updated_at = now();
END $$;

-- 7. REBUILD SEARCH INDEX FOR ALL EXISTING PRODUCTS
DO $$
DECLARE
  prod_rec RECORD;
BEGIN
  FOR prod_rec IN SELECT id FROM public.products LOOP
    PERFORM public.rebuild_search_index(prod_rec.id);
  END LOOP;
END $$;
