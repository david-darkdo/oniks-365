-- Ensure public bucket 'product-images' exists in storage.buckets
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'product-images',
  'product-images',
  true,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'],
  52428800
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop legacy storage policies if existing
DROP POLICY IF EXISTS "Public Read Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Product Images" ON storage.objects;

-- Allow Public Read on product-images
CREATE POLICY "Public Read Product Images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Allow Public/Anon/Authenticated Upload (Insert) on product-images
CREATE POLICY "Public Upload Product Images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images');

-- Allow Public/Anon/Authenticated Update on product-images
CREATE POLICY "Public Update Product Images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images');

-- Allow Public/Anon/Authenticated Delete on product-images
CREATE POLICY "Public Delete Product Images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images');
