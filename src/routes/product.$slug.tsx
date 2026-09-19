import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { fetchProductBySlug, fetchRelatedProducts, fetchFamilyProducts } from "@/lib/catalog";
import { ArrowLeft, Heart, ShoppingBag, X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Sparkles, Layers } from "lucide-react";
import { AddToCollectionButton } from "@/components/AddToCollectionButton";
import { publicImageUrl } from "@/components/ImageUploader";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites } from "@/hooks/useFavorites";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { getProductionOrigin } from "@/lib/origin";
import { getCanonicalProductSlug, getCanonicalProductUrl, getCanonicalProductPath } from "@/lib/product-url";

const productQuery = (slug: string, origin: string) =>
  queryOptions({
    queryKey: ["product", slug],
    queryFn: async () => {
      const p = await fetchProductBySlug(slug);
      if (!p) {
        // Section 21: Check redirects table for historical or legacy slug redirect (HTTP 301)
        const { data: redirectRow } = await supabase
          .from("redirects")
          .select("new_path, status_code")
          .eq("old_path", `/product/${slug}`)
          .maybeSingle();

        if (redirectRow?.new_path) {
          throw redirect({
            href: redirectRow.new_path.startsWith("http") ? redirectRow.new_path : `${origin}${redirectRow.new_path}`,
            statusCode: (redirectRow.status_code || 301) as any,
          });
        }
        throw notFound();
      }
      return p;
    },
  });

const relatedQuery = (
  familyId: string | null,
  excludeId: string,
  fallback?: { subcategoryId?: string | null; categoryId?: string | null; typeId?: string | null }
) =>
  queryOptions({
    queryKey: ["related", familyId, excludeId, fallback?.subcategoryId, fallback?.categoryId, fallback?.typeId],
    queryFn: () => fetchRelatedProducts(familyId, excludeId, null, fallback),
  });

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ context, params }) => {
    const origin = getProductionOrigin();
    const product = await context.queryClient.ensureQueryData(productQuery(params.slug, origin));

    // Redirect unnormalized or legacy slug formats to canonical URL (HTTP 301)
    const canonicalSlug = getCanonicalProductSlug(product);
    if (params.slug !== canonicalSlug) {
      throw redirect({
        href: getCanonicalProductUrl(product, origin),
        statusCode: 301,
      });
    }

    const fallbackHierarchy = {
      subcategoryId: product.subcategory_id,
      categoryId: product.category_id,
      typeId: product.type_id,
    };

    context.queryClient.ensureQueryData(relatedQuery(product.family_id, product.id, fallbackHierarchy));

    // Fetch taxonomy parents, installation assets, and sibling family variants
    const [typeRes, categoryRes, subcategoryRes, familyRes, assetsRes, familyVariants] = await Promise.all([
      product.type_id ? supabase.from("product_types").select("name, slug").eq("id", product.type_id).maybeSingle() : Promise.resolve({ data: null }),
      product.category_id ? supabase.from("categories").select("name, slug").eq("id", product.category_id).maybeSingle() : Promise.resolve({ data: null }),
      product.subcategory_id ? supabase.from("subcategories").select("name, slug").eq("id", product.subcategory_id).maybeSingle() : Promise.resolve({ data: null }),
      product.family_id ? supabase.from("family_groups").select("name, slug").eq("id", product.family_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("product_assets").select("id, asset_url, asset_type, created_at").eq("product_id", product.id).eq("asset_type", "installed").order("created_at", { ascending: false }),
      product.family_id ? fetchFamilyProducts(product.family_id, product.id) : Promise.resolve([]),
    ]);

    return {
      product,
      origin,
      installationAssets: assetsRes.data ?? [],
      familyVariants: familyVariants || [],
      taxonomy: {
        type: typeRes.data,
        category: categoryRes.data,
        subcategory: subcategoryRes.data,
        family: familyRes.data,
      }
    };
  },
  head: ({ loaderData }: any): any => {
    const product = loaderData?.product;
    const origin = loaderData?.origin || getProductionOrigin();
    const title = product?.seo_title || `${product?.name || "Product"} — ONIKS365`;
    const desc = product?.seo_description || product?.short_description || "Premium kitchen & bathroom solution details.";
    const imageUrl = product?.generated_studio_image || product?.image_url || "";
    const canonical = getCanonicalProductUrl(product, origin);

    return {
      meta: [
        { title: title },
        { name: "description", content: desc },
        { property: "og:type", content: "product" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:image", content: imageUrl ? publicImageUrl(imageUrl) : "" },
        { property: "og:url", content: canonical },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: imageUrl ? publicImageUrl(imageUrl) : "" },
      ],
      links: [
        { rel: "canonical", href: canonical }
      ]
    };
  },
  component: ProductPage,

  notFoundComponent: () => (
    <AppShell>
      <div className="container-app py-16 text-center">
        <h1 className="font-display text-2xl">Product not found</h1>
        <Link to="/" className="mt-4 inline-block text-primary underline">
          Back to feed
        </Link>
      </div>
    </AppShell>
  ),
  errorComponent: ({ error }) => (
    <AppShell>
      <div className="container-app py-16 text-center text-sm text-destructive">
        <h2 className="font-semibold text-lg">Failed to load product page</h2>
        <p className="mt-2 text-muted-foreground">{error.message}</p>
        <Link to="/" className="mt-4 inline-block text-primary underline">Back to feed</Link>
      </div>
    </AppShell>
  ),
});

function ProductDetailSkeleton() {
  return (
    <AppShell>
      <div className="container-app py-8 space-y-6 animate-pulse">
        {/* Breadcrumb skeleton */}
        <div className="h-3 w-48 bg-muted rounded"></div>

        {/* Gallery skeleton */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="aspect-square w-full bg-muted rounded-2xl"></div>
          <div className="aspect-[4/3] w-full bg-muted rounded-2xl"></div>
        </div>

        {/* Details skeleton */}
        <div className="space-y-3">
          <div className="h-3.5 w-32 bg-muted rounded"></div>
          <div className="h-8 w-80 bg-muted rounded"></div>
          <div className="h-6 w-24 bg-muted rounded"></div>
          <div className="h-20 w-full bg-muted rounded"></div>
        </div>
      </div>
    </AppShell>
  );
}

function ProductPage() {
  const { product, origin, installationAssets, taxonomy, familyVariants } = Route.useLoaderData();
  const fallbackHierarchy = useMemo(() => ({
    subcategoryId: product.subcategory_id,
    categoryId: product.category_id,
    typeId: product.type_id,
  }), [product.subcategory_id, product.category_id, product.type_id]);

  const { data: related = [] } = useSuspenseQuery(
    relatedQuery(product.family_id, product.id, fallbackHierarchy),
  );

  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const isFav = isFavorite(product.id);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  // Fixed Original Manufacturer Image (Source of Truth)
  const originalImageUrl = publicImageUrl(product.image_url) || publicImageUrl(product.generated_studio_image);

  // Switchable Installation Images Gallery
  const installationImages = useMemo(() => {
    const list: string[] = [];
    if (product.generated_installed_image) {
      const url = publicImageUrl(product.generated_installed_image);
      if (url) list.push(url);
    }
    (installationAssets || []).forEach((asset: any) => {
      const url = publicImageUrl(asset.asset_url) || asset.asset_url;
      if (url && !list.includes(url)) {
        list.push(url);
      }
    });
    return list;
  }, [product.generated_installed_image, installationAssets]);

  const [activeInstallationIndex, setActiveInstallationIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [lightboxScale, setLightboxScale] = useState(1);

  // Synchronized smooth auto-cycle for installation gallery (every 4s, pausing on hover)
  useEffect(() => {
    if (installationImages.length <= 1 || isPaused) return;
    const interval = setInterval(() => {
      setActiveInstallationIndex((prev) => (prev + 1) % installationImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [installationImages.length, isPaused, activeInstallationIndex]);

  const activeInstalledImage = installationImages[activeInstallationIndex] || installationImages[0] || null;

  const handleLightboxNav = (direction: "prev" | "next") => {
    if (!installationImages.length) return;
    setLightboxScale(1);
    const currentIndex = lightboxImg ? installationImages.indexOf(lightboxImg) : 0;
    const nextIndex = direction === "next"
      ? (currentIndex + 1) % installationImages.length
      : (currentIndex - 1 + installationImages.length) % installationImages.length;
    setLightboxImg(installationImages[nextIndex]);
  };

  useEffect(() => {
    if (!product?.id) return;

    if (user?.id) {
      // Track page views
      const trackEvent = async () => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("auth_id", user.id)
          .maybeSingle();
        if (!profile?.id) return;

        await supabase.from("customer_activity").insert({
          user_id: profile.id,
          activity_type: "product_viewed",
          metadata: { productId: product.id, name: product.name, category: (product as any).category || "Uncategorized" }
        });
      };
      void trackEvent();
    }

    // Load recommendations
    const loadRecs = async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("status" as any, "published")
        .neq("id", product.id)
        .limit(4);
      setRecommendations(data || []);
    };
    void loadRecs();
  }, [product?.id, user?.id]);

  const handleToggleFavorite = () => {
    void toggleFavorite(product.id, product);
  };

  // Breadcrumbs config
  const breadcrumbs = useMemo(() => {
    const list = [{ label: "Home", path: "/" }];
    if (taxonomy.type) {
      list.push({ label: taxonomy.type.name, path: `/${taxonomy.type.slug}` });
      if (taxonomy.category) {
        list.push({ label: taxonomy.category.name, path: `/${taxonomy.type.slug}/${taxonomy.category.slug}` });
        if (taxonomy.subcategory) {
          list.push({ label: taxonomy.subcategory.name, path: `/${taxonomy.type.slug}/${taxonomy.category.slug}/${taxonomy.subcategory.slug}` });
          if (taxonomy.family) {
            list.push({ label: taxonomy.family.name, path: `/${taxonomy.type.slug}/${taxonomy.category.slug}/${taxonomy.subcategory.slug}/${taxonomy.family.slug}` });
          }
        }
      }
    }
    list.push({ label: product.name, path: getCanonicalProductPath(product) });
    return list;
  }, [taxonomy, product]);

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((b, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": b.label,
      "item": b.path.startsWith("/") ? `${origin}${b.path}` : b.path
    }))
  };

  const canonicalProductUrl = getCanonicalProductUrl(product, origin);

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "image": [originalImageUrl, ...installationImages].filter(Boolean).map((img) => ({
      "@type": "ImageObject",
      "url": img,
      "name": product.alt_text || product.name,
      "caption": product.seo_description || product.short_description || product.name
    })),
    "description": product.seo_description || product.generated_description || product.short_description || "",
    "sku": product.code || product.id,
    "mpn": product.code || product.id,
    "brand": {
      "@type": "Brand",
      "name": product.brand || "ONIKS365"
    },
    "material": product.material || undefined,
    "color": product.color || undefined,
    "category": taxonomy.subcategory?.name ? `${taxonomy.category?.name || "Material"} > ${taxonomy.subcategory.name}` : (taxonomy.category?.name || "Material"),
    "offers": {
      "@type": "Offer",
      "url": canonicalProductUrl,
      "priceCurrency": "NGN",
      "price": product.price || 0,
      "priceValidUntil": "2027-12-31",
      "availability": "https://schema.org/InStock",
      "itemCondition": "https://schema.org/NewCondition",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": product.price || 0,
        "priceCurrency": "NGN",
        "unitText": (product as any).pricing_unit || "piece"
      },
      "seller": {
        "@type": "Organization",
        "name": "ONIKS365",
        "url": origin
      }
    }
  };

  const faqSchema = product.faq && Array.isArray(product.faq) ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": (product.faq as any[]).map((f) => ({
      "@type": "Question",
      "name": f.question || f.q || "",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": f.answer || f.a || ""
      }
    }))
  } : null;

  return (
    <AppShell>
      {/* Schema LD Injections */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      {faqSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      )}
      {product.structured_data && (product.structured_data as any)["@type"] !== "Product" && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(product.structured_data) }} />
      )}

      <div className="container-app pt-2 pb-10">
        {/* Breadcrumb Row */}
        <nav className="flex items-center gap-1.5 overflow-x-auto pb-3 text-[10px] uppercase tracking-wider text-muted-foreground scrollbar-none">
          {breadcrumbs.map((b, index) => (
            <span key={index} className="flex items-center gap-1.5 shrink-0">
              {index > 0 && <span className="text-muted-foreground/30">/</span>}
              {index === breadcrumbs.length - 1 ? (
                <span className="font-semibold text-foreground truncate max-w-[120px]">{b.label}</span>
              ) : (
                <Link to={b.path} className="hover:text-primary transition">{b.label}</Link>
              )}
            </span>
          ))}
        </nav>

        {/* Gallery Grid: Fixed Original Image (Left) + Switchable Installation Gallery (Right) */}
        <div className="mt-3 grid gap-6 md:grid-cols-2">
          {/* FIXED ORIGINAL MANUFACTURER IMAGE (Source of Truth — non-carousel) */}
          <div className="flex flex-col">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm aspect-square flex items-center justify-center">
              {originalImageUrl ? (
                <img
                  src={originalImageUrl}
                  alt={`${product.name} — Original Manufacturer`}
                  onClick={() => setLightboxImg(originalImageUrl)}
                  className="w-full h-full object-cover cursor-zoom-in hover:scale-[1.01] transition-transform duration-300"
                />
              ) : (
                <div className="text-xs text-muted-foreground italic">No original manufacturer image</div>
              )}
            </div>
            <div className="mt-2 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
              Original Manufacturer Image (Source of Truth)
            </div>
          </div>

          {/* SWITCHABLE INSTALLATION IMAGES GALLERY (Right) */}
          <div className="flex flex-col">
            {/* Full Visual Square Main Installation Viewport */}
            <div
              className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm aspect-square flex items-center justify-center"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {activeInstalledImage ? (
                <img
                  key={activeInstalledImage}
                  src={activeInstalledImage}
                  alt={`${product.name} — Installation View`}
                  loading="lazy"
                  onClick={() => setLightboxImg(activeInstalledImage)}
                  className="w-full h-full object-cover cursor-zoom-in hover:scale-[1.01] transition-all duration-300"
                />
              ) : (
                <div className="text-xs text-muted-foreground italic flex h-full items-center justify-center p-6 text-center">
                  No installation preview images uploaded yet
                </div>
              )}
            </div>

            {/* Compact Photograph Thumbnail Rail (OUTSIDE & BELOW card — Zero Text Labels) */}
            {installationImages.length > 1 && (
              <div 
                className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none snap-x"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
              >
                {installationImages.map((imgUrl, idx) => {
                  const isActive = activeInstallationIndex === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveInstallationIndex(idx)}
                      aria-label={`Installation photograph ${idx + 1}`}
                      className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer snap-start ${
                        isActive
                          ? "border-amber-500 ring-2 ring-amber-500/40 shadow-md scale-100 opacity-100"
                          : "border-border/80 hover:border-amber-500/50 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={imgUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Product Details Section */}
        <div className="mt-6 space-y-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-primary font-bold">
              {product.brand || "ONIKS365"} · Code {product.code}
            </p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight uppercase">
              {product.name}
            </h1>
            <div className="mt-1.5 flex items-baseline gap-2.5 flex-wrap">
              {(product as any).original_price != null && Number((product as any).original_price) > Number(product.price) && (
                <span className="line-through text-lg font-normal text-destructive">
                  ₦{Number((product as any).original_price).toLocaleString()}
                </span>
              )}
              <p className="font-display text-2xl font-bold text-primary">
                ₦{Number(product.price).toLocaleString()}
                <span className="ml-1 text-sm font-normal text-muted-foreground">/{(product as any).pricing_unit || "piece"}</span>
              </p>
            </div>
          </div>

          {product.short_description && (
            <div className="rounded-xl border border-border/80 bg-card p-4 text-xs leading-relaxed text-muted-foreground max-w-prose shadow-sm">
              {product.short_description}
            </div>
          )}

          {/* FAQ Accordion Section */}
          {product.faq && Array.isArray(product.faq) && (product.faq as any[]).length > 0 && (
            <div className="rounded-xl border border-border/80 bg-card p-4 text-xs space-y-3 max-w-prose shadow-sm">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground border-b border-border/40 pb-2">Frequently Asked Questions</h3>
              <div className="space-y-4">
                {(product.faq as any[]).map((f, i) => (
                  <div key={i} className="space-y-1">
                    <h4 className="font-semibold text-xs text-foreground flex gap-1.5 items-start">
                      <span className="text-primary font-bold">Q:</span>
                      <span>{f.question || f.q}</span>
                    </h4>
                    <p className="pl-4 text-xs text-muted-foreground leading-relaxed">{f.answer || f.a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technical Specifications & Subcategory Identity */}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs max-w-xl">
            {taxonomy.subcategory?.name && (
              <div className="rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 p-3 shadow-xs">
                <dt className="text-[9px] font-bold uppercase tracking-wider text-[#ea580c]">Subcategory</dt>
                <dd className="mt-1 font-bold text-[#0F1115] text-xs">{taxonomy.subcategory.name}</dd>
              </div>
            )}
            {(product as any).differentiator_note && (
              <div className="rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 p-3 shadow-xs">
                <dt className="text-[9px] font-bold uppercase tracking-wider text-[#ea580c]">
                  {(product as any).differentiator_type || "Feature"}
                </dt>
                <dd className="mt-1 font-bold text-[#0F1115] text-xs">{(product as any).differentiator_note}</dd>
              </div>
            )}
            {[
              ["Color", product.color],
              ["Material", product.material],
              ["Finish", product.finish],
            ].map(([k, v]) =>
              v ? (
                <div key={k as string} className="rounded-lg border border-[#E5E0D8] bg-white p-3 shadow-xs">
                  <dt className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{k}</dt>
                  <dd className="mt-1 font-semibold text-[#0F1115] text-xs">{v}</dd>
                </div>
              ) : null,
            )}
          </dl>

          {/* Actions Bar */}
          <div className="flex gap-2.5 max-w-md pt-2">
            <AddToCollectionButton
              productId={product.id}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0F1115] border border-[#C5A059]/40 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#1A1D24] hover:text-[#D4AF37] transition shadow-md"
            />
            <button
              onClick={handleToggleFavorite}
              className={`rounded px-5 py-3 border text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 ${
                isFav
                  ? "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Heart className={`h-4 w-4 text-red-500 hover:text-red-600 ${isFav ? "fill-red-500" : ""}`} />
              {isFav ? "Saved" : "Favorite"}
            </button>
          </div>
        </div>

        {/* FAMILY SIBLING VARIANTS (Section 13: Color / Finish / Material Variant Switching) */}
        {familyVariants && familyVariants.length > 0 && (
          <section className="mt-10 rounded-2xl border border-primary/20 bg-muted/30 p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary font-bold">
                  {taxonomy.family?.name || "Collection"} Variations
                </p>
                <h3 className="font-display text-base font-extrabold uppercase tracking-tight text-foreground">
                  Other Finishes & Variants in this Collection
                </h3>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                {familyVariants.length} available
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {familyVariants.map((v) => {
                const img = publicImageUrl(v.image_url) || publicImageUrl(v.generated_studio_image);
                return (
                  <Link
                    key={v.id}
                    to={getCanonicalProductPath(v)}
                    className="group flex flex-col rounded-xl border border-border bg-card p-2.5 transition hover:border-primary hover:shadow-md"
                  >
                    <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center">
                      {img ? (
                        <img
                          src={img}
                          alt={v.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">No image</span>
                      )}
                      {(v.color || v.finish) && (
                        <span className="absolute bottom-1.5 left-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                          {v.color || v.finish}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex-1">
                      <p className="text-[11px] font-bold text-foreground line-clamp-1 group-hover:text-primary transition">
                        {v.name}
                      </p>
                      <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">
                        {v.code ? `Code ${v.code}` : ""}
                      </p>
                      {v.price != null && (
                        <p className="mt-1 text-xs font-bold text-primary">
                          ₦{Number(v.price).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* RELATED PRODUCTS */}
        {related.length > 0 && (
          <section className="mt-12 border-t border-border/50 pt-8">
            <h2 className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              From the same design family
            </h2>
            <p className="font-display text-lg font-extrabold text-foreground uppercase tracking-tight">Related collections</p>
            <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}

        {/* RECOMMENDED PRODUCTS */}
        {recommendations.length > 0 && (
          <section className="mt-12 border-t border-border pt-8">
            <h2 className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Tailored for your design style
            </h2>
            <p className="font-display text-lg font-extrabold text-foreground uppercase tracking-tight">Recommended for you</p>
            <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {recommendations.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* FULLSCREEN LIGHTBOX GALLERY MODAL */}
      {lightboxImg && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 transition-all">
          {/* Close Area */}
          <div className="absolute inset-0" onClick={() => setLightboxImg(null)} />

          {/* Image & Controls wrapper */}
          <div className="relative z-10 flex flex-col items-center max-w-4xl max-h-[85vh] px-4">
            <div className="overflow-hidden flex items-center justify-center bg-zinc-900 rounded-lg">
              <img
                src={lightboxImg}
                alt="Fullscreen view"
                style={{ transform: `scale(${lightboxScale})` }}
                className="max-w-full max-h-[75vh] object-contain transition-transform duration-250 ease-out"
              />
            </div>

            {/* Scale Indicator */}
            {lightboxScale !== 1 && (
              <span className="absolute bottom-20 bg-black/55 text-white text-[9px] px-2 py-0.5 rounded font-mono">
                Zoom: {Math.round(lightboxScale * 100)}%
              </span>
            )}

            {/* Slider / Controls Panel */}
            <div className="mt-4 flex items-center justify-center gap-6 text-white bg-black/45 p-2 rounded-full border border-white/10">
              <button
                onClick={() => handleLightboxNav("prev")}
                className="p-2 rounded-full hover:bg-white/15 transition"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setLightboxScale(s => Math.min(s + 0.25, 3))}
                  className="p-1.5 rounded hover:bg-white/15 transition flex items-center gap-1 text-[10px] font-semibold"
                >
                  <ZoomIn className="h-4 w-4" /> Zoom In
                </button>
                <button
                  onClick={() => setLightboxScale(s => Math.max(s - 0.25, 0.75))}
                  className="p-1.5 rounded hover:bg-white/15 transition flex items-center gap-1 text-[10px] font-semibold"
                >
                  <ZoomOut className="h-4 w-4" /> Zoom Out
                </button>
                <button
                  onClick={() => setLightboxScale(1)}
                  className="p-1.5 rounded hover:bg-white/15 transition text-[10px] font-semibold"
                >
                  Reset
                </button>
              </div>

              <button
                onClick={() => handleLightboxNav("next")}
                className="p-2 rounded-full hover:bg-white/15 transition"
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Close button top right */}
          <button
            onClick={() => setLightboxImg(null)}
            className="absolute top-4 right-4 z-20 rounded-full p-2 bg-white/15 text-white hover:bg-white/25 transition"
            aria-label="Close fullscreen gallery"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </AppShell>
  );
}
