import { Link } from "@tanstack/react-router";
import type { ProductRow } from "@/lib/catalog";
import { AddToCollectionButton } from "./AddToCollectionButton";
import { publicImageUrl } from "./ImageUploader";
import { Heart } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { getCanonicalProductSlug } from "@/lib/product-url";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites } from "@/hooks/useFavorites";
import { toast } from "sonner";

export function ProductCardSkeleton() {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-border bg-card/60 shadow-xs select-none">
      <style>{`
        @keyframes cardBreathing {
          0%, 100% { transform: scale(0.94); opacity: 0.25; }
          50% { transform: scale(1.06); opacity: 0.55; }
        }
        .animate-card-breathing {
          animation: cardBreathing 2s ease-in-out infinite;
        }
      `}</style>
      <div className="aspect-square bg-muted/15 relative flex items-center justify-center overflow-hidden">
        <div className="animate-card-breathing">
          <img src="/logo.png" alt="Loading" className="h-9 w-auto object-contain opacity-40 dark:opacity-60" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="space-y-2">
          <div className="h-3.5 bg-muted/20 rounded-md w-3/4 animate-pulse" />
          <div className="h-2.5 bg-muted/15 rounded-md w-1/2 animate-pulse" />
        </div>
        <div className="h-4 bg-muted/10 rounded-md w-1/3 mt-2 animate-pulse" />
        <div className="mt-auto flex gap-2 pt-2 border-t border-border/30">
          <div className="flex-1 h-7 bg-muted/10 rounded animate-pulse" />
          <div className="flex-1 h-7 bg-muted/10 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function ProductCard({ product }: { product: ProductRow }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const isFav = isFavorite(product.id);

  const img =
    publicImageUrl(product.generated_studio_image) ||
    publicImageUrl(product.image_url) ||
    "https://placehold.co/600x600/121316/D4AF37?text=ONIKS365";

  // Determine if product is recently published (newer than 7 days)
  const isNew = useMemo(() => {
    const createdAt = (product as any).created_at;
    if (!createdAt) return false;
    const createdDate = new Date(createdAt);
    const diffTime = Math.abs(new Date().getTime() - createdDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  }, [(product as any).created_at]);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void toggleFavorite(product.id, product);
  };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-[#E5E0D8] bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-[#C5A059]">
      {/* Floating Badges */}
      {isNew && (
        <span className="absolute top-2.5 left-2.5 z-10 bg-[#0F1115] border border-[#C5A059]/50 backdrop-blur px-2.5 py-0.5 rounded text-[9px] font-bold text-[#D4AF37] tracking-wider uppercase shadow-md">
          NEW
        </span>
      )}

      {/* Floating Favorite Heart Icon */}
      <button
        onClick={handleToggleFavorite}
        className="absolute top-2.5 right-2.5 z-10 rounded-full p-2 bg-white/90 hover:bg-white text-foreground transition shadow-md border border-[#E5E0D8] focus:outline-none"
        aria-label={isFav ? "Remove from favorites" : "Save to favorites"}
      >
        <Heart className={`h-3.5 w-3.5 transition-colors duration-300 text-red-500 hover:text-red-600 ${isFav ? "fill-red-500 text-red-500" : ""}`} />
      </button>

      <Link
        to="/product/$slug"
        params={{ slug: getCanonicalProductSlug(product) }}
        className="block aspect-square overflow-hidden bg-[#F4F0EA]"
      >
        <img
          src={img}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div>
          <h3 className="font-display text-sm font-bold leading-tight text-[#0F1115] line-clamp-1 group-hover:text-[#ea580c] transition-colors">
            {product.name}
          </h3>
          <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            CODE · {product.code}
          </p>
        </div>
        <div className="flex items-baseline gap-1.5 flex-wrap mt-1">
          {product.original_price != null && Number(product.original_price) > Number(product.price) && (
            <span className="line-through text-xs font-normal text-destructive">
              ₦{Number(product.original_price).toLocaleString()}
            </span>
          )}
          <p className="font-display text-base font-extrabold text-[#0F1115]">
            ₦{Number(product.price).toLocaleString()}
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">/{product.pricing_unit || "piece"}</span>
          </p>
        </div>
        {product.differentiator_note && (
          <span className="inline-block self-start rounded bg-[#C5A059]/15 px-1.5 py-0.5 text-[9px] font-semibold text-[#8C6D23] line-clamp-1">
            {product.differentiator_note}
          </span>
        )}
        <div className="mt-auto flex gap-2 pt-2 border-t border-[#E5E0D8]/60">
          <AddToCollectionButton productId={product.id} compact />
          <Link
            to="/product/$slug"
            params={{ slug: getCanonicalProductSlug(product) }}
            className="flex-1 flex items-center justify-center rounded-lg bg-[#0F1115] border border-[#C5A059]/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-[#1A1D24] hover:text-[#D4AF37] transition shadow-xs"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
}
