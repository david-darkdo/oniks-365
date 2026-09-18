-- ONIKS 365 DISCOVERY ENGINE & FEED HERO MEDIA MIGRATION

-- 1. Create feed_hero_media table
CREATE TABLE IF NOT EXISTS public.feed_hero_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url text NOT NULL,
  thumbnail_url text,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  duration_seconds integer NOT NULL DEFAULT 10,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feed_hero_media ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone can view active feed hero media" ON public.feed_hero_media;
DROP POLICY IF EXISTS "Admins manage feed hero media" ON public.feed_hero_media;

-- Public can view active media
CREATE POLICY "Anyone can view active feed hero media"
  ON public.feed_hero_media
  FOR SELECT
  TO public
  USING (is_active = true);

-- Admins can manage all feed hero media
CREATE POLICY "Admins manage feed hero media"
  ON public.feed_hero_media
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_feed_hero_media_active_order ON public.feed_hero_media (is_active, order_index);

-- 2. Update search_products RPC: Remove processing_state = 'completed' blocker
-- Any published, non-hidden, non-deleted product must be immediately searchable
CREATE OR REPLACE FUNCTION public.search_products(_q text, _limit integer DEFAULT 60)
 RETURNS TABLE(product_id uuid, rank real)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT si.product_id,
         ts_rank(si.search_vector, plainto_tsquery('english', _q)) AS rank
  FROM public.search_index si
  JOIN public.products p ON p.id = si.product_id
  WHERE p.status = 'published'
    AND p.hidden = false
    AND p.deleted_at IS NULL
    AND (
      si.search_vector @@ plainto_tsquery('english', _q)
      OR si.combined_search_text ILIKE '%' || _q || '%'
      OR EXISTS (SELECT 1 FROM unnest(si.search_aliases) a WHERE a ILIKE '%' || _q || '%')
    )
  ORDER BY rank DESC NULLS LAST, p.created_at DESC
  LIMIT COALESCE(_limit, 60);
$function$;

-- 3. Seed initial curated Feed Hero Media items if empty
INSERT INTO public.feed_hero_media (title, media_type, media_url, thumbnail_url, order_index, is_active, duration_seconds)
SELECT 'Luxury Architectural Sanitaryware & Kitchen Sinks', 'image', 'https://res.cloudinary.com/dg5hey6bl/image/upload/f_auto,q_auto/v1788778510/products/rawgfcr6gkhcbrkoxj7r.webp', NULL, 0, true, 10
WHERE NOT EXISTS (SELECT 1 FROM public.feed_hero_media);

INSERT INTO public.feed_hero_media (title, media_type, media_url, thumbnail_url, order_index, is_active, duration_seconds)
SELECT 'Handmade Double Bowl Kitchen Solutions', 'image', 'https://res.cloudinary.com/dg5hey6bl/image/upload/f_auto,q_auto/v1788589046/products/iz6kqyxiw4pue7xzhzns.png', NULL, 1, true, 10
WHERE (SELECT count(*) FROM public.feed_hero_media) < 2;

INSERT INTO public.feed_hero_media (title, media_type, media_url, thumbnail_url, order_index, is_active, duration_seconds)
SELECT 'ONIKS365 Premium Architectural Collection', 'video', 'https://res.cloudinary.com/dg5hey6bl/video/upload/v1789073696/hero-videos/blrumd7spylgzij4znq7.mp4', NULL, 2, true, 15
WHERE (SELECT count(*) FROM public.feed_hero_media) < 3;
