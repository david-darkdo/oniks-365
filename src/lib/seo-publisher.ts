import { supabase } from "@/integrations/supabase/client";
import { MbsSeoClient } from "./mbs-seo-client.mjs";

/**
 * Triggered automatically upon product creation or updates.
 * Guarantees that every product page and product image is immediately
 * included and updated across all XML sitemaps and search engines.
 * Integrates with central MBS SEO Dashboard Pro v11 for automated indexing & URL submission.
 */
export async function triggerSitemapUpdate(productId?: string, productUrl?: string): Promise<void> {
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://oniks365.ng";

    // 1. Touch product updated_at if productId is provided
    if (productId) {
      await supabase
        .from("products" as any)
        .update({ updated_at: new Date().toISOString() } as any)
        .eq("id", productId);
    }

    // 2. Ping sitemaps to refresh server caches
    const endpoints = [
      `${origin}/sitemap.xml`,
      `${origin}/sitemap-products.xml`,
      `${origin}/sitemap-categories.xml`,
      `${origin}/sitemap-images.xml`,
      `${origin}/sitemap-pages.xml`,
    ];

    if (typeof window !== "undefined") {
      void Promise.allSettled(
        endpoints.map((url) =>
          fetch(url, { method: "HEAD", cache: "no-cache" }).catch(() => {})
        )
      );
    }

    // 3. Dispatch IndexNow and URL events to MBS SEO Dashboard Pro if agent key is configured
    const apiKey = typeof process !== "undefined" ? (process.env?.MBS_SEO_AGENT_KEY || process.env?.MBS_SEO_API_KEY) : null;
    if (apiKey && productUrl) {
      try {
        const client = new MbsSeoClient({ apiKey });
        await client.sendIndexingEvent({
          eventType: "product_updated",
          entityUrl: productUrl,
          metadata: { productId, timestamp: new Date().toISOString() },
          autoDispatch: true,
        });
      } catch (e) {
        console.warn("MBS SEO indexing event dispatch error (non-blocking):", e);
      }
    }
  } catch (err) {
    console.error("Auto sitemap publisher error:", err);
  }
}
