// @ts-nocheck
import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { publicImageUrl } from "@/components/ImageUploader";
import { ArrowRight, Layers } from "lucide-react";
import { slugify } from "@/lib/slug";
import { getCanonicalProductUrl } from "@/lib/product-url";

const PAGE_SIZE = 24;

type ResolvedHierarchy = {
  type: any;
  category: any;
  subcategory: any;
  family: any;
  products: any[];
  childCategories: any[];
  childSubcategories: any[];
  childFamilies: any[];
  origin: string;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

const hierarchyQuery = (splat: string, page: number = 1, origin: string = "") =>
  queryOptions({
    queryKey: ["hierarchy", splat, page],
    queryFn: async (): Promise<ResolvedHierarchy> => {
      const parts = splat.split("/").filter(Boolean);
      if (parts.length === 0 || parts.length > 5) {
        throw notFound();
      }

      // Check common alias routes
      const firstSegment = parts[0]?.toLowerCase();
      if (
        firstSegment === "home" ||
        firstSegment === "all-products" ||
        firstSegment === "shop" ||
        firstSegment === "products"
      ) {
        throw redirect({
          href: origin ? `${origin}/` : "/",
          statusCode: 301,
        });
      }

      // Check if last segment is a product slug (malformed legacy URLs like /doors/exterior-doors/Right door /copper-door)
      if (parts.length >= 3) {
        const lastPartSlug = slugify(parts[parts.length - 1]);
        if (lastPartSlug) {
          const { data: matchedProduct } = await supabase
            .from("products")
            .select("id, slug, name")
            .or(`slug.eq.${lastPartSlug},slug.eq.${parts[parts.length - 1]}`)
            .eq("status", "published")
            .eq("is_published", true)
            .eq("hidden", false)
            .is("deleted_at", null)
            .maybeSingle();

          if (matchedProduct) {
            throw redirect({
              href: getCanonicalProductUrl(matchedProduct, origin),
              statusCode: 301,
            });
          }
        }
      }

      const rawTypeSlug = parts[0];
      const decodedTypeSlug = decodeURIComponent(rawTypeSlug);
      const rawCatSlug = parts[1] || null;
      const decodedCatSlug = rawCatSlug ? decodeURIComponent(rawCatSlug) : null;
      const slug3 = parts[2] || null;
      const slug4 = parts[3] || null;

      // 1. Resolve Type
      const { data: type } = await supabase
        .from("product_types")
        .select("id, name, slug, code_prefix")
        .or(`slug.eq."${rawTypeSlug}",slug.eq."${decodedTypeSlug}"`)
        .maybeSingle();

      if (!type) throw notFound();

      // 2. Resolve Category if provided
      let category = null;
      if (rawCatSlug) {
        const { data: cat } = await supabase
          .from("categories")
          .select("id, name, slug, type_id")
          .eq("type_id", type.id)
          .or(`slug.eq."${rawCatSlug}",slug.eq."${decodedCatSlug}"`)
          .maybeSingle();
        if (!cat) throw notFound();
        category = cat;
      }

      // 3 & 4. Resolve Subcategory and Family Group based on parts length
      let subcategory = null;
      let family = null;

      if (category && parts.length === 3 && slug3) {
        const decodedSlug3 = decodeURIComponent(slug3);
        // 3-part URL: /type/category/slug3
        // Check if slug3 is a Subcategory first
        const { data: sub } = await supabase
          .from("subcategories")
          .select("id, name, slug, category_id")
          .eq("category_id", category.id)
          .or(`slug.eq."${slug3}",slug.eq."${decodedSlug3}"`)
          .maybeSingle();

        if (sub) {
          subcategory = sub;
        } else {
          // If not a subcategory, check if slug3 is a Family Group under this category
          const { data: subsForCat } = await supabase
            .from("subcategories")
            .select("id")
            .eq("category_id", category.id);

          const subIds = (subsForCat || []).map((s) => s.id);

          let famQuery = supabase
            .from("family_groups")
            .select("id, name, slug, subcategory_id, custom_ai_prompt_override")
            .or(`slug.eq."${slug3}",slug.eq."${decodedSlug3}"`);

          if (subIds.length > 0) {
            famQuery = famQuery.or(`subcategory_id.in.(${subIds.join(",")}),category_id.eq.${category.id}`);
          } else {
            famQuery = famQuery.eq("category_id", category.id);
          }

          const { data: fam } = await famQuery.maybeSingle();
          if (!fam) throw notFound();

          family = fam;
          if (fam.subcategory_id) {
            const { data: parentSub } = await supabase
              .from("subcategories")
              .select("id, name, slug, category_id")
              .eq("id", fam.subcategory_id)
              .maybeSingle();
            if (parentSub) subcategory = parentSub;
          }
        }
      } else if (category && parts.length === 4 && slug3 && slug4) {
        const decodedSlug3 = decodeURIComponent(slug3);
        const decodedSlug4 = decodeURIComponent(slug4);
        // 4-part URL: /type/category/subcategory/family
        const { data: sub } = await supabase
          .from("subcategories")
          .select("id, name, slug, category_id")
          .eq("category_id", category.id)
          .or(`slug.eq."${slug3}",slug.eq."${decodedSlug3}"`)
          .maybeSingle();

        if (!sub) throw notFound();
        subcategory = sub;

        const { data: fam } = await supabase
          .from("family_groups")
          .select("id, name, slug, subcategory_id, custom_ai_prompt_override")
          .eq("subcategory_id", sub.id)
          .or(`slug.eq."${slug4}",slug.eq."${decodedSlug4}"`)
          .maybeSingle();

        if (!fam) throw notFound();
        family = fam;
      }

      // 5. Fetch Products (Paginated)
      const currentPage = Math.max(1, Math.floor(page));
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let productsQuery = supabase
        .from("products")
        .select(
          "id, slug, name, code, price, brand, image_url, generated_studio_image, generated_installed_image, short_description, color, material, finish, alt_text",
          { count: "exact" }
        )
        .eq("processing_state", "completed")
        .eq("status", "published")
        .eq("is_published", true)
        .eq("hidden", false)
        .is("deleted_at", null);

      if (family) {
        productsQuery = productsQuery.eq("family_id", family.id);
      } else if (subcategory) {
        productsQuery = productsQuery.eq("subcategory_id", subcategory.id);
      } else if (category) {
        productsQuery = productsQuery.eq("category_id", category.id);
      } else {
        productsQuery = productsQuery.eq("type_id", type.id);
      }

      const { data: products, count: totalProductCount } = await productsQuery
        .order("created_at", { ascending: false })
        .range(from, to);

      const totalCount = totalProductCount ?? (products?.length || 0);
      const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

      // 6. Fetch Child taxonomy nodes
      let childCategories: any[] = [];
      let childSubcategories: any[] = [];
      let childFamilies: any[] = [];

      if (!category) {
        const { data } = await supabase
          .from("categories")
          .select("id, name, slug")
          .eq("type_id", type.id)
          .order("name");
        childCategories = data ?? [];
      } else if (!subcategory) {
        const { data: subs } = await supabase
          .from("subcategories")
          .select("id, name, slug")
          .eq("category_id", category.id)
          .order("name");
        childSubcategories = subs ?? [];

        const { data: fams } = await (supabase.from("family_groups") as any)
          .select("id, name, slug")
          .eq("category_id", category.id)
          .order("name");
        childFamilies = fams ?? [];
      } else if (!family) {
        const { data: fams } = await supabase
          .from("family_groups")
          .select("id, name, slug")
          .eq("subcategory_id", subcategory.id)
          .order("name");
        childFamilies = fams ?? [];
      }

      return {
        type,
        category,
        subcategory,
        family,
        products: products ?? [],
        childCategories,
        childSubcategories,
        childFamilies,
        origin,
        page: currentPage,
        pageSize: PAGE_SIZE,
        totalCount,
        totalPages,
      };
    },
  });

export const Route = createFileRoute("/$")({
  validateSearch: (search: Record<string, unknown>) => {
    const p = Number(search?.page);
    return {
      page: Number.isInteger(p) && p > 0 ? p : 1,
    };
  },
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ context, params, deps }) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://oniks365.ng";
    const data = await context.queryClient.ensureQueryData(
      hierarchyQuery((params as any)._splat ?? "", deps.page, origin)
    );
    return data;
  },
  head: ({ loaderData }: any): any => {
    if (!loaderData) return {};
    const { type, category, subcategory, family, origin, page, totalPages } = loaderData;

    // Resolve dynamic fallback meta details
    let title = "";
    let description = "";

    if (family) {
      title = `${family.name} Collection — Premium ${category.name} | ONIKS365`;
      description = `Explore the beautiful ${family.name} collection of premium ${category.name} ${type.name} at ONIKS365. View available colors, finishes, and specs.`;
    } else if (subcategory) {
      title = `Luxury ${subcategory.name} ${category.name} ${type.name} | ONIKS365`;
      description = `Browse our catalogue of premium ${subcategory.name} ${category.name} ${type.name} curated by ONIKS365.`;
    } else if (category) {
      title = `Premium ${category.name} ${type.name} | ONIKS365`;
      description = `Discover high-quality, luxury ${category.name} ${type.name} sanitary ware and kitchen solutions at ONIKS365.`;
    } else {
      title = `${type.name} Catalog | ONIKS365`;
      description = `Curated luxury ${type.name} collections. Discover premium sanitary ware, bathroom fittings, kitchen solutions, and appliances at ONIKS365.`;
    }

    const firstImage = loaderData.products[0]?.generated_studio_image || loaderData.products[0]?.image_url || "";
    const metaImageUrl = firstImage ? publicImageUrl(firstImage) : "";
    const basePath =
      `/${encodeURIComponent(type.slug)}` +
      (category ? `/${encodeURIComponent(category.slug)}` : "") +
      (subcategory ? `/${encodeURIComponent(subcategory.slug)}` : "") +
      (family ? `/${encodeURIComponent(family.slug)}` : "");
    const baseCanonical = `${origin}${basePath}`;
    const canonical = page > 1 ? `${baseCanonical}?page=${page}` : baseCanonical;

    const links: any[] = [{ rel: "canonical", href: canonical }];
    if (page > 1) {
      links.push({
        rel: "prev",
        href: page === 2 ? baseCanonical : `${baseCanonical}?page=${page - 1}`,
      });
    }
    if (page < totalPages) {
      links.push({
        rel: "next",
        href: `${baseCanonical}?page=${page + 1}`,
      });
    }

    return {
      meta: [
        { title: page > 1 ? `${title} (Page ${page})` : title },
        { name: "description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:title", content: page > 1 ? `${title} (Page ${page})` : title },
        { property: "og:description", content: description },
        { property: "og:image", content: metaImageUrl },
        { property: "og:url", content: canonical },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: page > 1 ? `${title} (Page ${page})` : title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: metaImageUrl },
      ],
      links,
    };
  },
  component: HierarchyLandingPage,
});

function HierarchyLandingPage() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const { data } = useSuspenseQuery(
    hierarchyQuery((params as any)._splat, search.page, "")
  );
  const {
    type,
    category,
    subcategory,
    family,
    products,
    childCategories,
    childSubcategories,
    childFamilies,
    origin,
    page,
    pageSize,
    totalCount,
    totalPages,
  } = data;

  // Build visual breadcrumbs array
  const breadcrumbs = [
    { label: "Home", path: "/" },
    { label: type.name, path: `/${type.slug}` },
  ];
  if (category) {
    breadcrumbs.push({ label: category.name, path: `/${type.slug}/${category.slug}` });
  }
  if (subcategory) {
    breadcrumbs.push({ label: subcategory.name, path: `/${type.slug}/${category.slug}/${subcategory.slug}` });
  }
  if (family) {
    const parentPath = subcategory
      ? `/${type.slug}/${category.slug}/${subcategory.slug}`
      : `/${type.slug}/${category.slug}`;
    breadcrumbs.push({ label: family.name, path: `${parentPath}/${family.slug}` });
  }

  // Schema BreadcrumbList
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: b.label,
      item: b.path.startsWith("/") ? `${origin}${b.path}` : b.path,
    })),
  };

  // Derive unique colors and finishes in this collection
  const colors = Array.from(new Set(products.map((p) => p.color).filter(Boolean)));
  const finishes = Array.from(new Set(products.map((p) => p.finish).filter(Boolean)));

  return (
    <AppShell>
      {/* Dynamic Schema Injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <div className="container-app pt-4">
        {/* Breadcrumb Trail */}
        <nav className="flex items-center gap-1.5 overflow-x-auto pb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          {breadcrumbs.map((b, index) => (
            <span key={index} className="flex items-center gap-1.5 shrink-0">
              {index > 0 && <span className="text-muted-foreground/40">/</span>}
              {index === breadcrumbs.length - 1 ? (
                <span className="font-semibold text-foreground">{b.label}</span>
              ) : (
                <Link to={b.path} className="hover:text-primary transition">
                  {b.label}
                </Link>
              )}
            </span>
          ))}
        </nav>

        {/* Landing Page Header */}
        <div className="mt-5 border-b border-border pb-6">
          <h1 className="font-display text-xs uppercase tracking-[0.2em] text-accent flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            {type.name} {category && `· ${category.name}`}
          </h1>
          <p className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {family ? family.name : subcategory ? subcategory.name : category ? category.name : type.name}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {family?.custom_ai_prompt_override ||
              `Browse our catalog of premium ${type.name.toLowerCase()} materials. ONIKS365 curates state of the art finishes for custom builder specifications.`}
          </p>
        </div>

        {/* Child Taxonomy Navigation */}
        {(childCategories.length > 0 || childSubcategories.length > 0 || childFamilies.length > 0) && (
          <div className="mt-6">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Explore Collections & Filters
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {childCategories.map((c) => (
                <Link
                  key={c.id}
                  to={`/${type.slug}/${c.slug}`}
                  className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition shrink-0"
                >
                  {c.name}
                </Link>
              ))}
              {childSubcategories.map((s) => (
                <Link
                  key={s.id}
                  to={`/${type.slug}/${category.slug}/${s.slug}`}
                  className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition shrink-0"
                >
                  {s.name}
                </Link>
              ))}
              {childFamilies.map((f) => {
                const parentPath = subcategory
                  ? `/${type.slug}/${category.slug}/${subcategory.slug}`
                  : `/${type.slug}/${category.slug}`;
                return (
                  <Link
                    key={f.id}
                    to={`${parentPath}/${f.slug}`}
                    className="rounded-full border border-border bg-accent/10 px-3.5 py-1.5 text-xs font-medium text-primary hover:bg-accent/25 transition shrink-0"
                  >
                    {f.name} Collection
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Collection details for Family Groups */}
        {family && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {colors.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Available Colours
                </h3>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {colors.join(" · ")}
                </p>
              </div>
            )}
            {finishes.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Available Finishes
                </h3>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {finishes.join(" · ")}
                </p>
              </div>
            )}
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Specifications
              </h3>
              <p className="mt-1 text-sm font-medium text-foreground">
                Abuja Stock · Premium Import
              </p>
            </div>
          </div>
        )}

        {/* Products Grid */}
        <div className="mt-8">
          <div className="flex items-baseline justify-between border-b border-border pb-3">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Products ({totalCount})
            </h2>
            <span className="text-xs text-muted-foreground">
              Showing premium matching assets
            </span>
          </div>

          {products.length === 0 ? (
            <div className="mt-10 rounded-xl border border-dashed border-border p-12 text-center bg-card/40">
              <p className="text-sm text-muted-foreground">
                No active products in this catalog level yet.
              </p>
              <Link
                to="/"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                Go to Home Catalogue <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {/* Crawlable Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border pt-6">
              <p className="text-xs text-muted-foreground">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount} products
              </p>
              <div className="flex items-center gap-1.5">
                {page > 1 ? (
                  <Link
                    to="."
                    search={{ page: page - 1 }}
                    rel="prev"
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary hover:text-primary transition"
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5 text-xs font-medium text-muted-foreground/50 cursor-not-allowed">
                    Previous
                  </span>
                )}

                {/* Page numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .map((p, idx, arr) => {
                    const prevP = arr[idx - 1];
                    const showEllipsis = prevP && p - prevP > 1;
                    return (
                      <span key={p} className="flex items-center">
                        {showEllipsis && <span className="px-1 text-xs text-muted-foreground">…</span>}
                        <Link
                          to="."
                          search={{ page: p }}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                            p === page
                              ? "border border-primary bg-primary text-primary-foreground font-bold shadow-xs"
                              : "border border-border bg-card text-foreground hover:border-primary hover:text-primary"
                          }`}
                        >
                          {p}
                        </Link>
                      </span>
                    );
                  })}

                {page < totalPages ? (
                  <Link
                    to="."
                    search={{ page: page + 1 }}
                    rel="next"
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary hover:text-primary transition"
                  >
                    Next
                  </Link>
                ) : (
                  <span className="rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5 text-xs font-medium text-muted-foreground/50 cursor-not-allowed">
                    Next
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
