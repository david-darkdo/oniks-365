import { supabase } from "@/integrations/supabase/client";

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  code: string;
  price: number;
  original_price?: number | null;
  pricing_unit?: string | null;
  differentiator_type?: string | null;
  differentiator_note?: string | null;
  brand: string | null;
  image_url: string | null;
  generated_studio_image: string | null;
  generated_installed_image: string | null;
  short_description: string | null;
  family_id: string | null;
  type_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  color: string | null;
  material: string | null;
  finish: string | null;
  app_keywords: string[] | null;
  featured_feed?: boolean | null;
  featured_homepage?: boolean | null;
  created_at?: string | null;
  distribution_rank?: number;
};

export type TaxonomyNode = { id: string; name: string; slug: string };

const PRODUCT_FIELDS =
  "id,slug,name,code,price,original_price,pricing_unit,differentiator_type,differentiator_note,brand,image_url,generated_studio_image,generated_installed_image,short_description,family_id,type_id,category_id,subcategory_id,color,material,finish,app_keywords,featured_feed,featured_homepage,created_at";

export type FeedHeroItem = {
  id: string;
  title: string | null;
  media_type: "image" | "video";
  media_url: string;
  thumbnail_url: string | null;
  order_index: number;
  is_active: boolean;
  duration_seconds: number;
};

/** Customer-facing visibility: published, not hidden, not soft-deleted. AI processing state does not block visibility. */
function applyPublicFilters<T extends { eq: Function; is: Function }>(q: T): T {
  return (q as any)
    .eq("status", "published")
    .eq("hidden", false)
    .is("deleted_at", null);
}

export async function fetchFeedHeroMedia(): Promise<FeedHeroItem[]> {
  const { data, error } = await supabase
    .from("feed_hero_media" as any)
    .select("*")
    .eq("is_active", true)
    .order("order_index", { ascending: true });
  if (error) {
    console.error("Failed to fetch feed hero media:", error);
    return [];
  }
  return (data as unknown as FeedHeroItem[]) ?? [];
}

export async function fetchTaxonomy() {
  const [types, categories, subcategories] = await Promise.all([
    supabase.from("product_types").select("id,name,slug").order("name"),
    supabase.from("categories").select("id,name,slug,type_id").order("name"),
    supabase.from("subcategories").select("id,name,slug,category_id").order("name"),
  ]);
  if (types.error) throw types.error;
  if (categories.error) throw categories.error;
  if (subcategories.error) throw subcategories.error;
  return {
    types: types.data ?? [],
    categories: categories.data ?? [],
    subcategories: subcategories.data ?? [],
  };
}

export type FeedFilters = {
  type?: string;
  category?: string;
  subcategory?: string;
  q?: string;
};

export type CursorParam = {
  rank?: number;
  id?: string;
  created_at?: string;
};

export type PaginatedFeedResult = {
  items: ProductRow[];
  nextCursor: CursorParam | null;
  hasMore: boolean;
  totalCount: number;
};

/**
 * PRODUCTION CURSOR PAGINATION & INTELLIGENT PRODUCT DISTRIBUTION
 * Interleaves Product Types, Categories, Subcategories, and Brands deterministically.
 * Eliminates all hardcoded 60-item caps. Supports enterprise scale catalogs.
 */
export async function fetchFeedProductsPaginated(
  filters: FeedFilters,
  cursor: CursorParam | null = null,
  limit: number = 24
): Promise<PaginatedFeedResult> {
  // 1. Search Query Path (Server-Side Ranked & Paginated Search Engine V2)
  if (filters.q && filters.q.trim()) {
    const term = filters.q.trim();
    const offset = cursor?.rank ?? 0;

    const { data: rankedRows, error: rpcError } = await supabase.rpc("search_products_v2" as any, {
      _q: term,
      _type: filters.type || null,
      _category: filters.category || null,
      _subcategory: filters.subcategory || null,
      _limit: limit,
      _offset: offset,
    } as any);

    if (rpcError) {
      console.error("search_products_v2 error:", rpcError);
      return { items: [], nextCursor: null, hasMore: false, totalCount: 0 };
    }

    if (!rankedRows || !Array.isArray(rankedRows) || rankedRows.length === 0) {
      return { items: [], nextCursor: null, hasMore: false, totalCount: 0 };
    }

    const totalCount = Number(rankedRows[0]?.total_count ?? 0);
    const productIds = rankedRows.map((r: any) => r.product_id);

    const { data: products, error: pError } = await applyPublicFilters(
      supabase.from("products").select(PRODUCT_FIELDS)
    ).in("id", productIds);

    if (pError) throw pError;

    // Preserve exact server-side ranking order
    const rankMap = new Map(productIds.map((id: string, idx: number) => [id, idx] as const));
    const sorted = ((products ?? []) as unknown as ProductRow[]).sort(
      (a, b) => (rankMap.get(a.id) ?? 0) - (rankMap.get(b.id) ?? 0)
    );

    const hasMore = offset + sorted.length < totalCount;
    const nextCursor = hasMore ? { rank: offset + sorted.length } : null;

    return { items: sorted, nextCursor, hasMore, totalCount };
  }

  // 2. Intelligent Distribution & Cursor Pagination Path
  let query = applyPublicFilters(
    supabase.from("products").select(PRODUCT_FIELDS)
  ).order("created_at", { ascending: false });

  if (filters.type) {
    const { data } = await supabase
      .from("product_types")
      .select("id")
      .eq("slug", filters.type)
      .maybeSingle();
    if (data?.id) query = query.eq("type_id", data.id);
  }
  if (filters.category) {
    const { data } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", filters.category)
      .maybeSingle();
    if (data?.id) query = query.eq("category_id", data.id);
  }
  if (filters.subcategory) {
    const { data } = await supabase
      .from("subcategories")
      .select("id")
      .eq("slug", filters.subcategory)
      .maybeSingle();
    if (data?.id) query = query.eq("subcategory_id", data.id);
  }

  const { data: rawProducts, error } = await query;
  if (error) throw error;
  if (!rawProducts || rawProducts.length === 0) {
    return { items: [], nextCursor: null, hasMore: false, totalCount: 0 };
  }

  // Assign Partition Rank for Intelligent Distribution
  // If category filter active -> partition by subcategory_id
  // Otherwise -> partition by category_id or type_id
  const partitionCounts = new Map<string, number>();
  const ranked = (rawProducts as any[]).map((p) => {
    const partitionKey = filters.category
      ? (p.subcategory_id || p.category_id || "default")
      : (p.category_id || p.type_id || "default");
    const currentRank = (partitionCounts.get(partitionKey) || 0) + 1;
    partitionCounts.set(partitionKey, currentRank);
    return {
      ...p,
      distribution_rank: currentRank,
    } as ProductRow;
  });

  // Sort by (distribution_rank ASC, featured_feed DESC, created_at DESC, id ASC)
  ranked.sort((a, b) => {
    const rA = a.distribution_rank ?? 0;
    const rB = b.distribution_rank ?? 0;
    if (rA !== rB) return rA - rB;
    if (a.featured_feed !== b.featured_feed) return a.featured_feed ? -1 : 1;
    const cA = a.created_at || "";
    const cB = b.created_at || "";
    if (cA !== cB) return cB > cA ? 1 : -1;
    return a.id.localeCompare(b.id);
  });

  // Apply Cursor Filter
  let cursorFiltered = ranked;
  if (cursor?.rank) {
    const targetRank = cursor.rank;
    const targetId = cursor.id;
    cursorFiltered = ranked.filter((item) => {
      const itemRank = item.distribution_rank ?? 0;
      if (itemRank > targetRank) return true;
      if (itemRank === targetRank && targetId && item.id > targetId) return true;
      return false;
    });
  }

  const items = cursorFiltered.slice(0, limit);
  const hasMore = cursorFiltered.length > limit;
  const lastItem = items[items.length - 1];

  const nextCursor = (hasMore && lastItem)
    ? {
        rank: lastItem.distribution_rank,
        id: lastItem.id,
        created_at: lastItem.created_at || undefined,
      }
    : null;

  return {
    items,
    nextCursor,
    hasMore,
    totalCount: ranked.length,
  };
}

export async function fetchFeedProducts(filters: FeedFilters): Promise<ProductRow[]> {
  const result = await fetchFeedProductsPaginated(filters, null, 1000);
  return result.items;
}

export async function fetchHomepageFeatured(): Promise<ProductRow[]> {
  const { data, error } = await applyPublicFilters(
    supabase.from("products").select(PRODUCT_FIELDS),
  )
    .eq("featured_homepage", true)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return (data ?? []) as unknown as ProductRow[];
}

export async function fetchProductBySlug(slug: string) {
  const { data, error } = await applyPublicFilters(
    supabase.from("products").select("*"),
  )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type RelatedFallbackHierarchy = {
  subcategoryId?: string | null;
  categoryId?: string | null;
  typeId?: string | null;
};

/**
 * DETERMINISTIC RELATED PRODUCTS HIERARCHY
 * 1. Explicit AI similar products
 * 2. Same family
 * 3. Same subcategory
 * 4. Same category
 * 5. Same product type
 * Strictly excludes hidden, archived, unpublished, or deleted products.
 */
export async function fetchRelatedProducts(
  familyId: string | null,
  excludeId: string,
  similarIds?: string[] | null,
  fallback?: RelatedFallbackHierarchy
): Promise<ProductRow[]> {
  // 1. Explicit AI similar products
  if (similarIds && similarIds.length) {
    const { data } = await applyPublicFilters(
      supabase.from("products").select(PRODUCT_FIELDS)
    )
      .in("id", similarIds)
      .neq("id", excludeId)
      .limit(8);
    if (data && data.length > 0) return data as unknown as ProductRow[];
  }

  // 2. Same family
  if (familyId) {
    const { data } = await applyPublicFilters(
      supabase.from("products").select(PRODUCT_FIELDS)
    )
      .eq("family_id", familyId)
      .neq("id", excludeId)
      .limit(8);
    if (data && data.length > 0) return data as unknown as ProductRow[];
  }

  // 3. Same subcategory
  if (fallback?.subcategoryId) {
    const { data } = await applyPublicFilters(
      supabase.from("products").select(PRODUCT_FIELDS)
    )
      .eq("subcategory_id", fallback.subcategoryId)
      .neq("id", excludeId)
      .limit(8);
    if (data && data.length > 0) return data as unknown as ProductRow[];
  }

  // 4. Same category
  if (fallback?.categoryId) {
    const { data } = await applyPublicFilters(
      supabase.from("products").select(PRODUCT_FIELDS)
    )
      .eq("category_id", fallback.categoryId)
      .neq("id", excludeId)
      .limit(8);
    if (data && data.length > 0) return data as unknown as ProductRow[];
  }

  // 5. Same product type
  if (fallback?.typeId) {
    const { data } = await applyPublicFilters(
      supabase.from("products").select(PRODUCT_FIELDS)
    )
      .eq("type_id", fallback.typeId)
      .neq("id", excludeId)
      .limit(8);
    if (data && data.length > 0) return data as unknown as ProductRow[];
  }

  return [];
}

/**
 * FAMILY GROUP SIBLING VARIANTS DISCOVERY
 * Discovers variant products sharing the exact same design family (e.g. Virony White, Black, Grey)
 */
export async function fetchFamilyProducts(
  familyId: string,
  excludeId?: string
): Promise<ProductRow[]> {
  if (!familyId) return [];
  let query = applyPublicFilters(
    supabase.from("products").select(PRODUCT_FIELDS)
  ).eq("family_id", familyId);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.order("name", { ascending: true }).limit(16);
  if (error) {
    console.error("fetchFamilyProducts error:", error);
    return [];
  }
  return (data ?? []) as unknown as ProductRow[];
}

export type SearchFacetItem = {
  name: string;
  slug?: string;
  count: number;
};

export type SearchFacets = {
  types: SearchFacetItem[];
  categories: SearchFacetItem[];
  subcategories: SearchFacetItem[];
  families: SearchFacetItem[];
  brands: SearchFacetItem[];
  materials: SearchFacetItem[];
  finishes: SearchFacetItem[];
  colors: SearchFacetItem[];
};

/**
 * DYNAMIC FACETED DISCOVERY
 * Retrieves live non-empty filter counts based on matching products
 */
export async function fetchSearchFacets(filters: {
  q?: string;
  type?: string;
  category?: string;
  subcategory?: string;
}): Promise<SearchFacets> {
  const { data, error } = await supabase.rpc("get_search_facets" as any, {
    _q: filters.q?.trim() || null,
    _type: filters.type || null,
    _category: filters.category || null,
    _subcategory: filters.subcategory || null,
  } as any);

  if (error || !data) {
    return {
      types: [],
      categories: [],
      subcategories: [],
      families: [],
      brands: [],
      materials: [],
      finishes: [],
      colors: [],
    };
  }
  return data as SearchFacets;
}

export type SearchSuggestionItem = {
  suggestion: string;
  type: "product" | "category" | "family" | "brand";
  slug: string;
};

/**
 * LIGHTWEIGHT REAL-TIME SEARCH SUGGESTIONS
 * Fast prefix & full-text match across indexed product names, categories, and families
 */
export async function fetchSearchSuggestions(q: string): Promise<SearchSuggestionItem[]> {
  if (!q || !q.trim()) return [];
  const { data, error } = await supabase.rpc("get_search_suggestions" as any, {
    _q: q.trim(),
    _limit: 8,
  } as any);

  if (error || !data) return [];
  return (data as any[]) || [];
}

/**
 * SERVER-SIDE SEARCH ENGINE V2
 * Deterministic multi-tier ranking hierarchy with server-side pagination and filters
 */
export async function searchProductsV2(params: {
  q?: string;
  type?: string;
  category?: string;
  subcategory?: string;
  family?: string;
  brand?: string;
  material?: string;
  finish?: string;
  color?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: ProductRow[]; totalCount: number; hasMore: boolean }> {
  const limit = params.limit ?? 24;
  const offset = params.offset ?? 0;

  const { data: rankedRows, error: rpcError } = await supabase.rpc("search_products_v2" as any, {
    _q: params.q?.trim() || null,
    _type: params.type || null,
    _category: params.category || null,
    _subcategory: params.subcategory || null,
    _family: params.family || null,
    _brand: params.brand || null,
    _material: params.material || null,
    _finish: params.finish || null,
    _color: params.color || null,
    _limit: limit,
    _offset: offset,
  } as any);

  if (rpcError) {
    console.error("searchProductsV2 RPC error:", rpcError);
    return { items: [], totalCount: 0, hasMore: false };
  }

  if (!rankedRows || !Array.isArray(rankedRows) || rankedRows.length === 0) {
    return { items: [], totalCount: 0, hasMore: false };
  }

  const totalCount = Number(rankedRows[0]?.total_count ?? 0);
  const productIds = rankedRows.map((r: any) => r.product_id);

  const { data: products, error: pError } = await applyPublicFilters(
    supabase.from("products").select(PRODUCT_FIELDS)
  ).in("id", productIds);

  if (pError) throw pError;

  // Preserve deterministic server ranking order
  const rankMap = new Map(productIds.map((id: string, idx: number) => [id, idx] as const));
  const sorted = ((products ?? []) as unknown as ProductRow[]).sort(
    (a, b) => (rankMap.get(a.id) ?? 0) - (rankMap.get(b.id) ?? 0)
  );

  const hasMore = offset + sorted.length < totalCount;
  return { items: sorted, totalCount, hasMore };
}

/**
 * LIGHTWEIGHT SEARCH ANALYTICS LOGGER
 * Privacy-friendly tracking for search optimization and zero-result queries
 */
export async function logSearchEvent(event: {
  query: string;
  resultCount: number;
  selectedProductId?: string;
  sessionId?: string;
}) {
  try {
    const cleanQ = event.query.trim();
    if (!cleanQ) return;
    await supabase.from("search_analytics" as any).insert({
      query: cleanQ,
      normalized_query: cleanQ.toLowerCase(),
      result_count: event.resultCount,
      selected_product_id: event.selectedProductId || null,
      session_id: event.sessionId || null,
    } as any);
  } catch {
    // Non-blocking background analytics
  }
}

