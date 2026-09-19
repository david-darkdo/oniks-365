import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import {
  searchProductsV2,
  fetchSearchFacets,
  fetchSearchSuggestions,
  logSearchEvent,
  type SearchSuggestionItem,
  type SearchFacets,
} from "@/lib/catalog";
import {
  Search as SearchIcon,
  X,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Sparkles,
  ArrowRight,
  CornerDownRight,
  Filter,
} from "lucide-react";

type SearchParams = {
  q: string;
  type?: string;
  category?: string;
  subcategory?: string;
  family?: string;
  brand?: string;
  material?: string;
  finish?: string;
  color?: string;
  page?: number;
};

function validateSearch(s: Record<string, unknown>): SearchParams {
  const pick = (k: string) => {
    const v = s[k];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  const pageNum = Number(s.page);
  return {
    q: typeof s.q === "string" ? s.q : "",
    type: pick("type"),
    category: pick("category"),
    subcategory: pick("subcategory"),
    family: pick("family"),
    brand: pick("brand"),
    material: pick("material"),
    finish: pick("finish"),
    color: pick("color"),
    page: Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1,
  };
}

export const Route = createFileRoute("/search")({
  validateSearch: validateSearch,
  head: ({ search }: any): any => ({
    meta: [
      {
        title: search?.q
          ? `"${search.q}" — ONIKS 365 Product Discovery`
          : "Product Discovery & Search — ONIKS 365 Digital Showroom",
      },
      {
        name: "description",
        content:
          "Discover luxury kitchen sinks, sanitary ware, smart toilets, and architectural fittings at ONIKS 365.",
      },
    ],
  }),
  component: SearchPage,
});

const PAGE_SIZE = 24;

function SearchPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const page = search.page || 1;

  // Local input state for typing & debounced suggestions
  const [inputValue, setInputValue] = useState(search.q);
  const [suggestions, setSuggestions] = useState<SearchSuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Sync input value with URL when query changes externally
  useEffect(() => {
    setInputValue(search.q);
  }, [search.q]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced Search Suggestions
  const handleInputChange = (val: string) => {
    setInputValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!val.trim() || val.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const list = await fetchSearchSuggestions(val);
        setSuggestions(list);
        setShowSuggestions(list.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 220);
  };

  // Submit search query
  const handleSearchSubmit = (targetQuery?: string) => {
    const q = targetQuery !== undefined ? targetQuery : inputValue;
    setShowSuggestions(false);
    navigate({
      to: "/search",
      search: {
        ...search,
        q: q.trim(),
        page: 1, // Reset to page 1 on new query
      },
    });
  };

  // Toggle or set a facet filter
  const setFacetFilter = (key: keyof SearchParams, value?: string) => {
    const current = search[key];
    const nextVal = current === value ? undefined : value; // Toggle off if already selected
    navigate({
      to: "/search",
      search: {
        ...search,
        [key]: nextVal,
        page: 1,
      },
    });
  };

  // Clear all filters
  const clearAllFilters = () => {
    navigate({
      to: "/search",
      search: {
        q: search.q,
        page: 1,
      },
    });
  };

  // 1. Server-Side Ranked Search Query
  const searchQuery = useQuery(
    queryOptions({
      queryKey: ["search_v2", search],
      queryFn: () =>
        searchProductsV2({
          q: search.q,
          type: search.type,
          category: search.category,
          subcategory: search.subcategory,
          family: search.family,
          brand: search.brand,
          material: search.material,
          finish: search.finish,
          color: search.color,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        }),
      staleTime: 30_000,
    })
  );

  // 2. Dynamic Facets Query
  const facetsQuery = useQuery(
    queryOptions({
      queryKey: ["search_facets", search.q, search.type, search.category, search.subcategory],
      queryFn: () =>
        fetchSearchFacets({
          q: search.q,
          type: search.type,
          category: search.category,
          subcategory: search.subcategory,
        }),
      staleTime: 60_000,
    })
  );

  const totalCount = searchQuery.data?.totalCount ?? 0;
  const products = searchQuery.data?.items ?? [];
  const facets: SearchFacets = facetsQuery.data ?? {
    types: [],
    categories: [],
    subcategories: [],
    families: [],
    brands: [],
    materials: [],
    finishes: [],
    colors: [],
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Track search analytics
  useEffect(() => {
    if (search.q.trim() && !searchQuery.isLoading && searchQuery.data) {
      void logSearchEvent({
        query: search.q,
        resultCount: totalCount,
      });
    }
  }, [search.q, totalCount, searchQuery.isLoading]);

  // Active filters count
  const activeFiltersCount = [
    search.type,
    search.category,
    search.subcategory,
    search.family,
    search.brand,
    search.material,
    search.finish,
    search.color,
  ].filter(Boolean).length;

  return (
    <AppShell>
      <div className="container-app pt-4 sm:pt-6 pb-16 space-y-6">
        {/* Editorial Search Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-[0.2em] text-primary">
              ONIKS 365 Discovery Engine
            </span>
            {totalCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                {totalCount} {totalCount === 1 ? "Product" : "Products"}
              </span>
            )}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground uppercase">
            Product Discovery & Catalog Search
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl font-light">
            Search precision-engineered kitchen sinks, smart sanitary ware, and luxury fittings across Nigeria by code, material, family, or finish.
          </p>
        </div>

        {/* Search Input Bar with Real-Time Suggestions */}
        <div ref={searchContainerRef} className="relative max-w-3xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearchSubmit();
            }}
            className="relative flex items-center"
          >
            <SearchIcon className="pointer-events-none absolute left-4 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder='Try "sink", "smart toilet", "ON-KIT-000001", "black matte", "virony"…'
              className="w-full rounded-2xl border-2 border-border/80 bg-card py-3.5 pl-12 pr-24 text-sm font-medium outline-none transition focus:border-primary shadow-xs"
            />
            {inputValue && (
              <button
                type="button"
                onClick={() => {
                  setInputValue("");
                  handleSearchSubmit("");
                }}
                className="absolute right-16 p-1.5 text-muted-foreground hover:text-foreground transition rounded-full"
                aria-label="Clear query"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              type="submit"
              className="absolute right-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition shadow-xs"
            >
              Search
            </button>
          </form>

          {/* Floating Search Suggestions Popover */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden backdrop-blur-md">
              <div className="p-2 border-b border-border/50 text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 flex items-center justify-between">
                <span>Instant Suggestions</span>
                <span className="font-mono text-[9px]">Select to filter</span>
              </div>
              <div className="py-1 max-h-72 overflow-y-auto">
                {suggestions.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (item.type === "category") {
                        setFacetFilter("category", item.slug || item.suggestion);
                      } else if (item.type === "family") {
                        setFacetFilter("family", item.slug || item.suggestion);
                      } else if (item.type === "brand") {
                        setFacetFilter("brand", item.suggestion);
                      } else {
                        handleSearchSubmit(item.suggestion);
                      }
                      setShowSuggestions(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs hover:bg-muted/70 flex items-center justify-between group transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 transition" />
                      <span className="font-medium text-foreground truncate">{item.suggestion}</span>
                    </div>
                    <span className="ml-2 rounded-md bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
                      {item.type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Faceted Discovery Rail */}
        <div className="space-y-3 rounded-2xl border border-border/70 bg-card/60 p-4 shadow-2xs backdrop-blur-xs">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-border/40 pb-2.5">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Filter Discovery Facets
              </span>
              {activeFiltersCount > 0 && (
                <span className="rounded-full bg-primary text-primary-foreground px-2 py-0.2 text-[10px] font-extrabold">
                  {activeFiltersCount}
                </span>
              )}
            </div>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[11px] font-semibold text-destructive hover:underline flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Clear all filters
              </button>
            )}
          </div>

          {/* Facet Group 1: Product Types */}
          {facets.types.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">Type:</span>
              {facets.types.map((t) => {
                const isActive = search.type === t.slug || search.type === t.name;
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setFacetFilter("type", t.slug || t.name)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                    }`}
                  >
                    <span>{t.name}</span>
                    <span className={`text-[10px] font-mono ${isActive ? "opacity-90" : "opacity-60"}`}>
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Facet Group 2: Categories */}
          {facets.categories.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">Category:</span>
              {facets.categories.map((c) => {
                const isActive = search.category === c.slug || search.category === c.name;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setFacetFilter("category", c.slug || c.name)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className={`text-[10px] font-mono ${isActive ? "opacity-90" : "opacity-60"}`}>
                      {c.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Facet Group 3: Subcategories (Sizes & Types) */}
          {facets.subcategories.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">Subcategory:</span>
              {facets.subcategories.map((s) => {
                const isActive = search.subcategory === s.slug || search.subcategory === s.name;
                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => setFacetFilter("subcategory", s.slug || s.name)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                    }`}
                  >
                    <span>{s.name}</span>
                    <span className={`text-[10px] font-mono ${isActive ? "opacity-90" : "opacity-60"}`}>
                      {s.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Facet Group 4: Brands, Families, Finishes */}
          {(facets.brands.length > 0 || facets.finishes.length > 0) && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">Attributes:</span>
              {facets.brands.slice(0, 5).map((b) => {
                const isActive = search.brand === b.name;
                return (
                  <button
                    key={`brand-${b.name}`}
                    type="button"
                    onClick={() => setFacetFilter("brand", b.name)}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition cursor-pointer ${
                      isActive
                        ? "bg-primary/20 border border-primary text-primary font-bold"
                        : "border border-border/70 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>{b.name}</span>
                    <span className="text-[9px] font-mono opacity-60">({b.count})</span>
                  </button>
                );
              })}

              {facets.finishes.slice(0, 5).map((fn) => {
                const isActive = search.finish === fn.name;
                return (
                  <button
                    key={`finish-${fn.name}`}
                    type="button"
                    onClick={() => setFacetFilter("finish", fn.name)}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition cursor-pointer ${
                      isActive
                        ? "bg-primary/20 border border-primary text-primary font-bold"
                        : "border border-border/70 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>{fn.name}</span>
                    <span className="text-[9px] font-mono opacity-60">({fn.count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Product Grid Area */}
        {searchQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    void logSearchEvent({
                      query: search.q,
                      resultCount: totalCount,
                      selectedProductId: p.id,
                    });
                  }}
                >
                  <ProductCard product={p} />
                </div>
              ))}
            </div>

            {/* Server-Side Pagination Bar */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} results
                </p>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() =>
                      navigate({
                        to: "/search",
                        search: { ...search, page: page - 1 },
                      })
                    }
                    className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40 transition cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <span className="text-xs font-bold text-foreground font-mono">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() =>
                      navigate({
                        to: "/search",
                        search: { ...search, page: page + 1 },
                      })
                    }
                    className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40 transition cursor-pointer"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Rich Zero-Result Experience (Section 6) */
          <div className="rounded-2xl border-2 border-dashed border-border/90 bg-card/40 p-8 sm:p-12 text-center space-y-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted/80 text-muted-foreground">
              <SearchIcon className="h-7 w-7" />
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <h2 className="font-display text-lg sm:text-xl font-bold text-foreground">
                No exact matches found {search.q ? <span>for &ldquo;{search.q}&rdquo;</span> : ""}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                We couldn&apos;t find any published products matching your search criteria. Try checking for misspellings, broadening your search term, or clearing active facet filters.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-xl border border-border bg-background px-4 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition shadow-xs"
                >
                  Clear Active Filters ({activeFiltersCount})
                </button>
              )}

              <Link
                to="/"
                className="rounded-xl bg-muted px-4 py-2.5 text-xs font-bold text-foreground hover:bg-muted/80 transition"
              >
                Browse Full Showroom Feed
              </Link>
            </div>

            {/* Suggested Popular Categories */}
            <div className="pt-4 border-t border-border/40 max-w-lg mx-auto space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Or discover popular collections
              </p>
              <div className="flex justify-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleSearchSubmit("kitchen sink")}
                  className="rounded-full bg-card border border-border px-3.5 py-1.5 text-xs font-medium hover:border-primary transition"
                >
                  Kitchen Sinks
                </button>
                <button
                  type="button"
                  onClick={() => handleSearchSubmit("smart toilet")}
                  className="rounded-full bg-card border border-border px-3.5 py-1.5 text-xs font-medium hover:border-primary transition"
                >
                  Smart Toilets
                </button>
                <button
                  type="button"
                  onClick={() => handleSearchSubmit("double bowl")}
                  className="rounded-full bg-card border border-border px-3.5 py-1.5 text-xs font-medium hover:border-primary transition"
                >
                  Double Bowl Sinks
                </button>
                <button
                  type="button"
                  onClick={() => handleSearchSubmit("standing basin")}
                  className="rounded-full bg-card border border-border px-3.5 py-1.5 text-xs font-medium hover:border-primary transition"
                >
                  Standing Basins
                </button>
              </div>
            </div>

            {/* WhatsApp Showroom Specialist Consultation CTA */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 max-w-lg mx-auto space-y-2.5">
              <div className="flex items-center justify-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <Sparkles className="h-4 w-4" />
                <span>Custom Showroom Architectural Sourcing</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Looking for a specific luxury sanitary fitting or architectural dimension not in our digital feed? Speak directly with our Dei-Dei / Abuja showroom procurement engineers.
              </p>
              <a
                href={`https://wa.me/2349030009365?text=${encodeURIComponent(
                  `Hello ONIKS 365 Showroom, I am searching for: "${search.q || "luxury architectural fittings"}" on your catalog and would like consultation.`
                )}`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Consult on WhatsApp (+234 903 000 9365)</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

