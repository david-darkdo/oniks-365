-- Migration: 20260921220000_collection_lifecycle_snapshot_hardening.sql
-- Description: Enforce database-level immutability for submitted collection snapshots and atomic submission RPC

-- 1. Ensure reference_number column exists on collections
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS reference_number text;

-- Backfill reference_number for existing collections if null
UPDATE public.collections 
SET reference_number = 'ONK-' || to_char(COALESCE(submitted_at, created_at, now()), 'YYYY') || '-' || upper(substring(replace(id::text, '-', ''), 1, 6))
WHERE reference_number IS NULL;

-- 2. Drop existing loose or obsolete policies on collections and collection_items
DROP POLICY IF EXISTS "Users manage own collections" ON public.collections;
DROP POLICY IF EXISTS "Users manage items in own collections" ON public.collection_items;
DROP POLICY IF EXISTS "Admins manage all collections" ON public.collections;
DROP POLICY IF EXISTS "Admins manage all collection_items" ON public.collection_items;
DROP POLICY IF EXISTS "Users create own draft collections" ON public.collections;
DROP POLICY IF EXISTS "Users update own active collections" ON public.collections;
DROP POLICY IF EXISTS "Users delete own active collections" ON public.collections;
DROP POLICY IF EXISTS "Users insert items to own active collections" ON public.collection_items;
DROP POLICY IF EXISTS "Users update items in own active collections" ON public.collection_items;
DROP POLICY IF EXISTS "Users delete items in own active collections" ON public.collection_items;

-- 3. Admin policies: Admins and super_admins retain full operational management
CREATE POLICY "Admins manage all collections" ON public.collections 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins manage all collection_items" ON public.collection_items 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 4. Customer collections policies:
-- Customer users can insert draft collections (must be unlocked and not submitted)
CREATE POLICY "Users create own draft collections" ON public.collections 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND (is_locked = false OR is_locked IS NULL) 
  AND submitted_at IS NULL
);

-- Customer users can ONLY update their own UNLOCKED active collections
CREATE POLICY "Users update own active collections" ON public.collections 
FOR UPDATE 
USING (
  auth.uid() = user_id 
  AND (is_locked = false OR is_locked IS NULL) 
  AND submitted_at IS NULL
) 
WITH CHECK (
  auth.uid() = user_id
);

-- Customer users can ONLY delete their own UNLOCKED active collections
CREATE POLICY "Users delete own active collections" ON public.collections 
FOR DELETE 
USING (
  auth.uid() = user_id 
  AND (is_locked = false OR is_locked IS NULL) 
  AND submitted_at IS NULL
);

-- 5. Customer collection_items policies:
-- Customer users can ONLY insert items into their own UNLOCKED active collections
CREATE POLICY "Users insert items to own active collections" ON public.collection_items 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.collections c 
    WHERE c.id = collection_items.collection_id 
      AND c.user_id = auth.uid() 
      AND (c.is_locked = false OR c.is_locked IS NULL) 
      AND c.submitted_at IS NULL
  )
);

-- Customer users can ONLY update items in their own UNLOCKED active collections
CREATE POLICY "Users update items in own active collections" ON public.collection_items 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.collections c 
    WHERE c.id = collection_items.collection_id 
      AND c.user_id = auth.uid() 
      AND (c.is_locked = false OR c.is_locked IS NULL) 
      AND c.submitted_at IS NULL
  )
) 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.collections c 
    WHERE c.id = collection_items.collection_id 
      AND c.user_id = auth.uid() 
      AND (c.is_locked = false OR c.is_locked IS NULL) 
      AND c.submitted_at IS NULL
  )
);

-- Customer users can ONLY delete items from their own UNLOCKED active collections
CREATE POLICY "Users delete items in own active collections" ON public.collection_items 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.collections c 
    WHERE c.id = collection_items.collection_id 
      AND c.user_id = auth.uid() 
      AND (c.is_locked = false OR c.is_locked IS NULL) 
      AND c.submitted_at IS NULL
  )
);

-- 6. Atomic submission RPC: locks collection, marks snapshot submitted, and provisions fresh active draft
CREATE OR REPLACE FUNCTION public.submit_collection_snapshot(_collection_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_is_locked boolean;
  v_submitted_at timestamptz;
  v_new_col_id uuid;
  v_ref_num text;
  v_caller_id uuid := auth.uid();
  v_is_admin boolean := false;
  v_project_name text;
BEGIN
  -- 1. Fetch and lock target collection row FOR UPDATE
  SELECT user_id, is_locked, submitted_at, project_name, reference_number
  INTO v_user_id, v_is_locked, v_submitted_at, v_project_name, v_ref_num
  FROM public.collections
  WHERE id = _collection_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Collection % not found', _collection_id;
  END IF;

  -- 2. Security validation: caller must be owner or admin
  IF v_caller_id IS NOT NULL THEN
    v_is_admin := (
      public.has_role(v_caller_id, 'admin'::app_role) OR 
      public.has_role(v_caller_id, 'super_admin'::app_role)
    );
    IF v_caller_id <> v_user_id AND NOT v_is_admin THEN
      RAISE EXCEPTION 'Unauthorized: Caller % is not owner of collection %', v_caller_id, _collection_id;
    END IF;
  END IF;

  -- 3. Idempotent check: if already locked or submitted, return existing snapshot state
  IF v_is_locked = true OR v_submitted_at IS NOT NULL THEN
    -- Look up or create active draft for this user
    SELECT id INTO v_new_col_id
    FROM public.collections
    WHERE user_id = v_user_id
      AND (is_locked = false OR is_locked IS NULL)
      AND submitted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_new_col_id IS NULL THEN
      INSERT INTO public.collections (user_id, name, status, is_locked, project_name)
      VALUES (v_user_id, 'Project Workspace', 'Draft', false, v_project_name)
      RETURNING id INTO v_new_col_id;
    END IF;

    IF v_ref_num IS NULL THEN
      v_ref_num := 'ONK-' || to_char(COALESCE(v_submitted_at, now()), 'YYYY') || '-' || upper(substring(replace(_collection_id::text, '-', ''), 1, 6));
      UPDATE public.collections SET reference_number = v_ref_num WHERE id = _collection_id;
    END IF;

    RETURN jsonb_build_object(
      'submitted_collection_id', _collection_id,
      'new_active_collection_id', v_new_col_id,
      'reference_number', v_ref_num,
      'already_submitted', true
    );
  END IF;

  -- 4. Generate persistent reference number
  v_ref_num := 'ONK-' || to_char(now(), 'YYYY') || '-' || upper(substring(replace(_collection_id::text, '-', ''), 1, 6));

  -- 5. Mark target collection as locked and submitted
  UPDATE public.collections
  SET is_locked = true,
      status = 'Submitted',
      submitted_at = now(),
      updated_at = now(),
      reference_number = v_ref_num
  WHERE id = _collection_id;

  -- 6. Automatically provision clean new active draft for customer
  INSERT INTO public.collections (user_id, name, status, is_locked, project_name)
  VALUES (v_user_id, 'Project Workspace', 'Draft', false, v_project_name)
  RETURNING id INTO v_new_col_id;

  RETURN jsonb_build_object(
    'submitted_collection_id', _collection_id,
    'new_active_collection_id', v_new_col_id,
    'reference_number', v_ref_num,
    'already_submitted', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_collection_snapshot(uuid) TO authenticated, anon, service_role;
