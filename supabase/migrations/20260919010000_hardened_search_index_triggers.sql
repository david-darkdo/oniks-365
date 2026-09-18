-- ONIKS 365 SEARCH INDEX HARDENING & HIERARCHY SYNCHRONIZATION MIGRATION

-- 1. Products DELETE trigger for search_index cleanup
CREATE OR REPLACE FUNCTION public.products_after_delete_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.search_index WHERE product_id = OLD.id;
  RETURN OLD;
END $function$;

DROP TRIGGER IF EXISTS trg_products_search_delete ON public.products;
CREATE TRIGGER trg_products_search_delete
  AFTER DELETE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION products_after_delete_trigger();

-- 2. Taxonomy Hierarchy Triggers for deterministic search index sync
CREATE OR REPLACE FUNCTION public.sync_products_search_on_taxonomy_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- If name changed, touch updated_at on all referencing products so trg_products_search_sync rebuilds their search index
  IF (TG_TABLE_NAME = 'categories' AND NEW.name IS DISTINCT FROM OLD.name) THEN
    UPDATE public.products SET updated_at = now() WHERE category_id = NEW.id;
  ELSIF (TG_TABLE_NAME = 'subcategories' AND NEW.name IS DISTINCT FROM OLD.name) THEN
    UPDATE public.products SET updated_at = now() WHERE subcategory_id = NEW.id;
  ELSIF (TG_TABLE_NAME = 'product_types' AND NEW.name IS DISTINCT FROM OLD.name) THEN
    UPDATE public.products SET updated_at = now() WHERE type_id = NEW.id;
  ELSIF (TG_TABLE_NAME = 'family_groups' AND NEW.name IS DISTINCT FROM OLD.name) THEN
    UPDATE public.products SET updated_at = now() WHERE family_id = NEW.id;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_categories_search_sync ON public.categories;
CREATE TRIGGER trg_categories_search_sync
  AFTER UPDATE OF name ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION sync_products_search_on_taxonomy_change();

DROP TRIGGER IF EXISTS trg_subcategories_search_sync ON public.subcategories;
CREATE TRIGGER trg_subcategories_search_sync
  AFTER UPDATE OF name ON public.subcategories
  FOR EACH ROW
  EXECUTE FUNCTION sync_products_search_on_taxonomy_change();

DROP TRIGGER IF EXISTS trg_product_types_search_sync ON public.product_types;
CREATE TRIGGER trg_product_types_search_sync
  AFTER UPDATE OF name ON public.product_types
  FOR EACH ROW
  EXECUTE FUNCTION sync_products_search_on_taxonomy_change();

DROP TRIGGER IF EXISTS trg_family_groups_search_sync ON public.family_groups;
CREATE TRIGGER trg_family_groups_search_sync
  AFTER UPDATE OF name ON public.family_groups
  FOR EACH ROW
  EXECUTE FUNCTION sync_products_search_on_taxonomy_change();
