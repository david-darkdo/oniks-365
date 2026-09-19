-- ONIKS 365 — BUILD 3: DISCOVERY ENGINE INTELLIGENCE & SEO PUBLICATION MIGRATION

-- 1. Search Analytics Table
CREATE TABLE IF NOT EXISTS public.search_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  normalized_query text NOT NULL,
  result_count integer NOT NULL DEFAULT 0,
  selected_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_analytics_normalized_query ON public.search_analytics(normalized_query);
CREATE INDEX IF NOT EXISTS idx_search_analytics_result_count ON public.search_analytics(result_count);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created_at ON public.search_analytics(created_at DESC);

ALTER TABLE public.search_analytics ENABLE ROW LEVEL SECURITY;

-- Allow public insertion for anonymous/customer search tracking
DROP POLICY IF EXISTS "Public search analytics insert" ON public.search_analytics;
CREATE POLICY "Public search analytics insert" ON public.search_analytics
  FOR INSERT TO public, anon, authenticated WITH CHECK (true);

-- Allow authenticated admins to view analytics
DROP POLICY IF EXISTS "Admin search analytics select" ON public.search_analytics;
CREATE POLICY "Admin search analytics select" ON public.search_analytics
  FOR SELECT TO authenticated USING (true);


-- 2. Enhanced rebuild_search_index Function (Manual + AI Intelligence)
CREATE OR REPLACE FUNCTION public.rebuild_search_index(_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE 
  p record; 
  t_name text; 
  c_name text; 
  s_name text; 
  f_name text; 
  ic_name text;
  size_val text; 
  size_aliases text[]; 
  ai_synonyms text[] := ARRAY[]::text[];
  ai_alt_names text[] := ARRAY[]::text[];
  ai_related text[] := ARRAY[]::text[];
  ai_search_phrases text[] := ARRAY[]::text[];
  ai_misspellings text[] := ARRAY[]::text[];
  ai_google_tags text[] := ARRAY[]::text[];
  ai_keywords text[] := ARRAY[]::text[];
  combined_aliases text[];
  master jsonb; 
  combined text;
  ai_doc jsonb;
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
  size_aliases := public.generate_size_aliases(size_val);

  -- Extract AI intelligence arrays if available
  ai_doc := COALESCE(p.ai_understanding, '{}'::jsonb);

  IF jsonb_typeof(ai_doc->'search_synonyms') = 'array' THEN
    SELECT array_agg(value#>>'{}') INTO ai_synonyms FROM jsonb_array_elements(ai_doc->'search_synonyms');
  END IF;

  IF jsonb_typeof(ai_doc->'alternative_names') = 'array' THEN
    SELECT array_agg(value#>>'{}') INTO ai_alt_names FROM jsonb_array_elements(ai_doc->'alternative_names');
  END IF;

  IF jsonb_typeof(ai_doc->'related_search_terms') = 'array' THEN
    SELECT array_agg(value#>>'{}') INTO ai_related FROM jsonb_array_elements(ai_doc->'related_search_terms');
  END IF;

  IF jsonb_typeof(ai_doc->'customer_search_phrases') = 'array' THEN
    SELECT array_agg(value#>>'{}') INTO ai_search_phrases FROM jsonb_array_elements(ai_doc->'customer_search_phrases');
  END IF;

  IF jsonb_typeof(ai_doc->'common_misspellings') = 'array' THEN
    SELECT array_agg(value#>>'{}') INTO ai_misspellings FROM jsonb_array_elements(ai_doc->'common_misspellings');
  END IF;

  IF jsonb_typeof(ai_doc->'google_search_tags') = 'array' THEN
    SELECT array_agg(value#>>'{}') INTO ai_google_tags FROM jsonb_array_elements(ai_doc->'google_search_tags');
  END IF;

  -- Combine all search aliases & keywords
  combined_aliases := array_cat(
    COALESCE(size_aliases, ARRAY[]::text[]),
    COALESCE(ai_synonyms, ARRAY[]::text[])
  );
  combined_aliases := array_cat(combined_aliases, COALESCE(ai_alt_names, ARRAY[]::text[]));
  combined_aliases := array_cat(combined_aliases, COALESCE(ai_misspellings, ARRAY[]::text[]));

  ai_keywords := COALESCE(p.app_keywords, ARRAY[]::text[])
    || COALESCE(p.seo_keywords, ARRAY[]::text[])
    || COALESCE(ai_google_tags, ARRAY[]::text[])
    || COALESCE(ai_related, ARRAY[]::text[]);

  master := jsonb_build_object(
    'title', p.name, 
    'code', p.code,
    'brand', p.brand,
    'manufacturer', p.brand,
    'finish', COALESCE(p.finish, p.finish_name),
    'material', p.material,
    'color', p.color,
    'type', t_name, 
    'category', c_name, 
    'subcategory', s_name, 
    'family', f_name,
    'size', size_val, 
    'pricing_unit', p.pricing_unit,
    'differentiator_type', p.differentiator_type,
    'differentiator_note', p.differentiator_note,
    'installation_context', ic_name, 
    'aliases', to_jsonb(combined_aliases),
    'keywords', to_jsonb(ai_keywords),
    'synonyms', to_jsonb(COALESCE(ai_synonyms, ARRAY[]::text[])),
    'alternative_names', to_jsonb(COALESCE(ai_alt_names, ARRAY[]::text[])),
    'customer_search_phrases', to_jsonb(COALESCE(ai_search_phrases, ARRAY[]::text[])),
    'ai_description', p.generated_description,
    'seo_title', p.seo_title, 
    'seo_description', p.seo_description
  );

  combined := concat_ws(' ',
    p.name, p.code, p.brand, p.color, p.material, p.finish, p.finish_name,
    p.short_description, p.generated_description, p.seo_title, p.seo_description,
    p.differentiator_note, p.differentiator_type, p.pricing_unit,
    t_name, c_name, s_name, f_name, ic_name, size_val,
    array_to_string(combined_aliases, ' '), 
    array_to_string(ai_keywords, ' '),
    array_to_string(ai_search_phrases, ' ')
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
    combined_aliases, 
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
END $function$;


-- 3. Super Admin Rebuild Entire Search Index RPC
CREATE OR REPLACE FUNCTION public.rebuild_entire_search_index()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  prod record;
  indexed_cnt integer := 0;
  orphaned_cnt integer := 0;
BEGIN
  -- 1. Remove orphaned index entries (e.g. deleted or archived products)
  WITH deleted AS (
    DELETE FROM public.search_index
    WHERE product_id NOT IN (
      SELECT id FROM public.products
      WHERE status = 'published'
        AND hidden = false
        AND deleted_at IS NULL
    )
    RETURNING product_id
  )
  SELECT count(*) INTO orphaned_cnt FROM deleted;

  -- 2. Rebuild search_index for all published products
  FOR prod IN 
    SELECT id FROM public.products
    WHERE status = 'published'
      AND hidden = false
      AND deleted_at IS NULL
  LOOP
    PERFORM public.rebuild_search_index(prod.id);
    indexed_cnt := indexed_cnt + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'indexed_count', indexed_cnt,
    'orphaned_removed', orphaned_cnt,
    'timestamp', now()
  );
END $function$;


-- 4. Search Products V2 RPC: Server-Side Ranking, Filtering, and Pagination
CREATE OR REPLACE FUNCTION public.search_products_v2(
  _q text DEFAULT NULL,
  _type text DEFAULT NULL,
  _category text DEFAULT NULL,
  _subcategory text DEFAULT NULL,
  _family text DEFAULT NULL,
  _brand text DEFAULT NULL,
  _material text DEFAULT NULL,
  _finish text DEFAULT NULL,
  _color text DEFAULT NULL,
  _limit integer DEFAULT 24,
  _offset integer DEFAULT 0
)
RETURNS TABLE(product_id uuid, rank real, total_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  clean_q text;
  has_query boolean;
BEGIN
  clean_q := trim(COALESCE(_q, ''));
  has_query := length(clean_q) > 0;

  RETURN QUERY
  WITH scored_candidates AS (
    SELECT 
      p.id AS pid,
      p.created_at AS p_created,
      CASE 
        WHEN NOT has_query THEN 1.0::real
        -- Deterministic Ranking Hierarchy:
        -- 1. Exact Product Name (Weight 100)
        WHEN lower(p.name) = lower(clean_q) THEN 100.0::real
        -- 2. Exact Product Code (Weight 95)
        WHEN lower(COALESCE(p.code, '')) = lower(clean_q) THEN 95.0::real
        -- 3. Exact Family Name (Weight 90)
        WHEN lower(COALESCE(fg.name, '')) = lower(clean_q) THEN 90.0::real
        -- 4. Exact Brand (Weight 85)
        WHEN lower(COALESCE(p.brand, '')) = lower(clean_q) THEN 85.0::real
        -- 5. Exact Product Type (Weight 80)
        WHEN lower(COALESCE(pt.name, '')) = lower(clean_q) THEN 80.0::real
        -- 6. Exact Category (Weight 75)
        WHEN lower(COALESCE(cat.name, '')) = lower(clean_q) THEN 75.0::real
        -- 7. Exact Subcategory (Weight 70)
        WHEN lower(COALESCE(sub.name, '')) = lower(clean_q) THEN 70.0::real
        -- Starts with Name or Code (Weight 65)
        WHEN p.name ILIKE clean_q || '%' OR p.code ILIKE clean_q || '%' THEN 65.0::real
        -- Name contains Query word (Weight 55)
        WHEN p.name ILIKE '%' || clean_q || '%' THEN 55.0::real
        -- Search Aliases exact/prefix (Weight 45)
        WHEN EXISTS (SELECT 1 FROM unnest(si.search_aliases) a WHERE a ILIKE clean_q || '%') THEN 45.0::real
        -- Search Vector Match (Weight 20-35 depending on ts_rank)
        WHEN si.search_vector @@ plainto_tsquery('english', clean_q) THEN
          (20.0 + (ts_rank(si.search_vector, plainto_tsquery('english', clean_q)) * 15.0))::real
        -- Combined Text Substring Match (Weight 15)
        WHEN si.combined_search_text ILIKE '%' || clean_q || '%' THEN 15.0::real
        ELSE 0.0::real
      END AS calc_rank
    FROM public.products p
    LEFT JOIN public.search_index si ON si.product_id = p.id
    LEFT JOIN public.product_types pt ON pt.id = p.type_id
    LEFT JOIN public.categories cat ON cat.id = p.category_id
    LEFT JOIN public.subcategories sub ON sub.id = p.subcategory_id
    LEFT JOIN public.family_groups fg ON fg.id = p.family_id
    WHERE p.status = 'published'
      AND p.hidden = false
      AND p.deleted_at IS NULL
      -- Filter by Type (slug or name)
      AND (_type IS NULL OR pt.slug = _type OR pt.name = _type)
      -- Filter by Category (slug or name)
      AND (_category IS NULL OR cat.slug = _category OR cat.name = _category)
      -- Filter by Subcategory (slug or name)
      AND (_subcategory IS NULL OR sub.slug = _subcategory OR sub.name = _subcategory)
      -- Filter by Family (slug or name)
      AND (_family IS NULL OR fg.slug = _family OR fg.name = _family)
      -- Filter by Brand
      AND (_brand IS NULL OR p.brand ILIKE _brand)
      -- Filter by Material
      AND (_material IS NULL OR p.material ILIKE _material)
      -- Filter by Finish
      AND (_finish IS NULL OR p.finish ILIKE _finish OR p.finish_name ILIKE _finish)
      -- Filter by Color
      AND (_color IS NULL OR p.color ILIKE _color)
      -- Query Match requirement if query provided
      AND (
        NOT has_query 
        OR si.search_vector @@ plainto_tsquery('english', clean_q)
        OR si.combined_search_text ILIKE '%' || clean_q || '%'
        OR p.name ILIKE '%' || clean_q || '%'
        OR p.code ILIKE '%' || clean_q || '%'
        OR EXISTS (SELECT 1 FROM unnest(si.search_aliases) a WHERE a ILIKE '%' || clean_q || '%')
      )
  ),
  counted AS (
    SELECT count(*)::bigint AS full_count FROM scored_candidates WHERE calc_rank > 0
  )
  SELECT 
    sc.pid AS product_id,
    sc.calc_rank AS rank,
    c.full_count AS total_count
  FROM scored_candidates sc
  CROSS JOIN counted c
  WHERE sc.calc_rank > 0
  ORDER BY sc.calc_rank DESC, sc.p_created DESC
  LIMIT COALESCE(_limit, 24)
  OFFSET COALESCE(_offset, 0);
END $function$;


-- 5. Dynamic Facets RPC for Active Result Sets
CREATE OR REPLACE FUNCTION public.get_search_facets(
  _q text DEFAULT NULL,
  _type text DEFAULT NULL,
  _category text DEFAULT NULL,
  _subcategory text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  clean_q text;
  has_query boolean;
  result jsonb;
BEGIN
  clean_q := trim(COALESCE(_q, ''));
  has_query := length(clean_q) > 0;

  WITH filtered_products AS (
    SELECT 
      p.id,
      pt.name AS type_name, pt.slug AS type_slug,
      cat.name AS cat_name, cat.slug AS cat_slug,
      sub.name AS sub_name, sub.slug AS sub_slug,
      fg.name AS fam_name, fg.slug AS fam_slug,
      p.brand,
      p.material,
      COALESCE(p.finish, p.finish_name) AS finish,
      p.color
    FROM public.products p
    LEFT JOIN public.search_index si ON si.product_id = p.id
    LEFT JOIN public.product_types pt ON pt.id = p.type_id
    LEFT JOIN public.categories cat ON cat.id = p.category_id
    LEFT JOIN public.subcategories sub ON sub.id = p.subcategory_id
    LEFT JOIN public.family_groups fg ON fg.id = p.family_id
    WHERE p.status = 'published'
      AND p.hidden = false
      AND p.deleted_at IS NULL
      AND (_type IS NULL OR pt.slug = _type OR pt.name = _type)
      AND (_category IS NULL OR cat.slug = _category OR cat.name = _category)
      AND (_subcategory IS NULL OR sub.slug = _subcategory OR sub.name = _subcategory)
      AND (
        NOT has_query 
        OR si.search_vector @@ plainto_tsquery('english', clean_q)
        OR si.combined_search_text ILIKE '%' || clean_q || '%'
        OR p.name ILIKE '%' || clean_q || '%'
        OR p.code ILIKE '%' || clean_q || '%'
        OR EXISTS (SELECT 1 FROM unnest(si.search_aliases) a WHERE a ILIKE '%' || clean_q || '%')
      )
  )
  SELECT jsonb_build_object(
    'types', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', type_name, 'slug', type_slug, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
      FROM (SELECT type_name, type_slug, count(*) as cnt FROM filtered_products WHERE type_name IS NOT NULL GROUP BY type_name, type_slug) t
    ),
    'categories', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', cat_name, 'slug', cat_slug, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
      FROM (SELECT cat_name, cat_slug, count(*) as cnt FROM filtered_products WHERE cat_name IS NOT NULL GROUP BY cat_name, cat_slug) c
    ),
    'subcategories', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', sub_name, 'slug', sub_slug, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
      FROM (SELECT sub_name, sub_slug, count(*) as cnt FROM filtered_products WHERE sub_name IS NOT NULL GROUP BY sub_name, sub_slug) s
    ),
    'families', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', fam_name, 'slug', fam_slug, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
      FROM (SELECT fam_name, fam_slug, count(*) as cnt FROM filtered_products WHERE fam_name IS NOT NULL GROUP BY fam_name, fam_slug) f
    ),
    'brands', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', brand, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
      FROM (SELECT brand, count(*) as cnt FROM filtered_products WHERE brand IS NOT NULL AND brand <> '' GROUP BY brand) b
    ),
    'materials', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', material, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
      FROM (SELECT material, count(*) as cnt FROM filtered_products WHERE material IS NOT NULL AND material <> '' GROUP BY material) m
    ),
    'finishes', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', finish, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
      FROM (SELECT finish, count(*) as cnt FROM filtered_products WHERE finish IS NOT NULL AND finish <> '' GROUP BY finish) fn
    ),
    'colors', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', color, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
      FROM (SELECT color, count(*) as cnt FROM filtered_products WHERE color IS NOT NULL AND color <> '' GROUP BY color) cl
    )
  ) INTO result;

  RETURN result;
END $function$;


-- 6. Lightweight Search Suggestions RPC
CREATE OR REPLACE FUNCTION public.get_search_suggestions(
  _q text,
  _limit integer DEFAULT 8
)
RETURNS TABLE(suggestion text, type text, slug text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  clean_q text;
BEGIN
  clean_q := trim(COALESCE(_q, ''));
  IF length(clean_q) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  (
    -- Matching Product Names
    SELECT p.name AS suggestion, 'product'::text AS type, p.slug
    FROM public.products p
    WHERE p.status = 'published' AND p.hidden = false AND p.deleted_at IS NULL
      AND (p.name ILIKE clean_q || '%' OR p.name ILIKE '%' || clean_q || '%')
    LIMIT 4
  )
  UNION ALL
  (
    -- Matching Categories
    SELECT c.name AS suggestion, 'category'::text AS type, c.slug
    FROM public.categories c
    WHERE c.name ILIKE clean_q || '%' OR c.name ILIKE '%' || clean_q || '%'
    LIMIT 2
  )
  UNION ALL
  (
    -- Matching Families
    SELECT f.name AS suggestion, 'family'::text AS type, f.slug
    FROM public.family_groups f
    WHERE f.name ILIKE clean_q || '%' OR f.name ILIKE '%' || clean_q || '%'
    LIMIT 2
  )
  UNION ALL
  (
    -- Matching Brands
    SELECT DISTINCT p.brand AS suggestion, 'brand'::text AS type, ''::text AS slug
    FROM public.products p
    WHERE p.status = 'published' AND p.hidden = false AND p.deleted_at IS NULL
      AND p.brand IS NOT NULL AND p.brand <> ''
      AND p.brand ILIKE clean_q || '%'
    LIMIT 2
  )
  LIMIT COALESCE(_limit, 8);
END $function$;


-- 7. Slug Redirect Trigger on Products Table
CREATE OR REPLACE FUNCTION public.products_slug_redirect_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (OLD.slug IS NOT NULL AND NEW.slug IS NOT NULL AND OLD.slug IS DISTINCT FROM NEW.slug) THEN
    INSERT INTO public.redirects (old_path, new_path, status_code)
    VALUES ('/product/' || OLD.slug, '/product/' || NEW.slug, 301)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_products_slug_redirect ON public.products;
CREATE TRIGGER trg_products_slug_redirect
  AFTER UPDATE OF slug ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION products_slug_redirect_trigger();
