-- ONIKS 365 — BUILD 4: ADMIN PRODUCT OPERATIONS & SEARCH HARDENING MIGRATION

-- 1. Hardened Search Suggestions RPC
-- Ensure category and family suggestions only return if they have at least 1 active, published, unhidden product
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
    -- Matching Categories (Only if containing active published products)
    SELECT c.name AS suggestion, 'category'::text AS type, c.slug
    FROM public.categories c
    WHERE (c.name ILIKE clean_q || '%' OR c.name ILIKE '%' || clean_q || '%')
      AND EXISTS (
        SELECT 1 FROM public.products p 
        WHERE p.category_id = c.id 
          AND p.status = 'published' 
          AND p.hidden = false 
          AND p.deleted_at IS NULL
      )
    LIMIT 2
  )
  UNION ALL
  (
    -- Matching Families (Only if containing active published products)
    SELECT f.name AS suggestion, 'family'::text AS type, f.slug
    FROM public.family_groups f
    WHERE (f.name ILIKE clean_q || '%' OR f.name ILIKE '%' || clean_q || '%')
      AND EXISTS (
        SELECT 1 FROM public.products p 
        WHERE p.family_id = f.id 
          AND p.status = 'published' 
          AND p.hidden = false 
          AND p.deleted_at IS NULL
      )
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
