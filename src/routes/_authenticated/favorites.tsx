import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites } from "@/hooks/useFavorites";
import { AppShell } from "@/components/AppShell";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { Heart, ArrowRight } from "lucide-react";
import type { ProductRow } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({ meta: [{ title: "My Favorites — ONIKS365" }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user } = useAuth();
  const { favoriteIds, loading: favLoading } = useFavorites();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFavoriteProducts = useCallback(async () => {
    if (favoriteIds.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id,slug,name,code,price,brand,image_url,generated_studio_image,generated_installed_image,short_description,family_id,type_id,category_id,subcategory_id,color,material,finish,app_keywords,featured_feed,featured_homepage")
        .in("id", favoriteIds)
        .eq("processing_state", "completed")
        .eq("status", "published")
        .eq("hidden", false)
        .is("deleted_at", null);

      if (!error && data) {
        setProducts(data as ProductRow[]);
      }
    } catch (err) {
      console.error("Failed to load favorite products:", err);
    } finally {
      setLoading(false);
    }
  }, [favoriteIds]);

  useEffect(() => {
    void loadFavoriteProducts();
  }, [loadFavoriteProducts]);

  return (
    <AppShell>
      <div className="container-app py-8 space-y-6">
        <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Heart className="h-6 w-6 text-red-500 fill-red-500" />
              My Favorites
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your saved shortlist of luxury finishes, tiles, doors, and architectural materials.
            </p>
          </div>
          <div className="text-xs font-semibold text-muted-foreground bg-card border border-border px-3 py-1.5 rounded-full self-start sm:self-auto">
            {favoriteIds.length} Saved {favoriteIds.length === 1 ? "Item" : "Items"}
          </div>
        </div>

        {loading || favLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-xl space-y-4 bg-card/30">
            <Heart className="h-10 w-10 text-muted-foreground mx-auto" />
            <div>
              <h2 className="font-semibold text-foreground text-sm">No favorited items yet</h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                Explore our catalog and click the heart icon on any product to save it to your shortlist.
              </p>
            </div>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition shadow-sm"
            >
              Browse Catalogue
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
