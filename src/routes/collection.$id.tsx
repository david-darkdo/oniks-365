import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProductsByIds, detectProductUnit, getUserCollectionHistory } from "@/lib/collection";
import { useAppSettings, waLink } from "@/lib/settings";
import { MessageCircle, Lock, ArrowLeft, Plus, History, ShieldAlert, CheckCircle2 } from "lucide-react";
import { publicImageUrl } from "@/components/ImageUploader";

import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/collection/$id")({
  loader: async ({ params }) => {
    let imageUrl = "";
    try {
      const { data: items } = await supabase
        .from("collection_items")
        .select("product_id")
        .eq("collection_id", params.id)
        .limit(1);
      
      if (items && items.length > 0) {
        const { data: prod } = await supabase
          .from("products")
          .select("generated_studio_image, image_url")
          .eq("id", items[0].product_id)
          .maybeSingle();
        if (prod) {
          imageUrl = prod.generated_studio_image || prod.image_url || "";
        }
      }
    } catch (e) {
      // swallow
    }
    return { imageUrl };
  },
  head: ({ loaderData }) => {
    const title = "Project Collection History — ONIKS365";
    const desc = "Review your submitted kitchen & bathroom quotation request on ONIKS365.";
    const img = (loaderData as any)?.imageUrl || "https://oniks365.ng/logo.png";
    return {
      meta: [
        { title: title },
        { name: "description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:title", title },
        { property: "og:description", desc },
        { property: "og:image", content: img },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", title },
        { name: "twitter:description", desc },
        { name: "twitter:image", content: img }
      ]
    };
  },
  component: SharedCollection,
});

function SharedCollection() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: settings } = useAppSettings();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [collection, setCollection] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [otherCollections, setOtherCollections] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Authenticated administrators are automatically resolved to the quotation manager
  useEffect(() => {
    if (isAdmin) {
      navigate({ to: "/admin/collections/$id", params: { id }, replace: true });
    }
  }, [isAdmin, id, navigate]);

  // If unauthenticated, redirect to auth preserving the exact destination
  useEffect(() => {
    if (!authLoading && !user && !isAdmin) {
      navigate({ to: "/auth", search: { redirectTo: `/collection/${id}` } });
    }
  }, [authLoading, user, isAdmin, id, navigate]);

  useEffect(() => {
    const load = async () => {
      // Select ONLY customer-safe fields to ensure internal administrator notes and margins are never exposed
      const { data: c } = await supabase
        .from("collections")
        .select("id, name, project_name, reference_number, version, is_locked, status, created_at, submitted_at, user_id")
        .eq("id", id)
        .maybeSingle();
      if (c) setCollection(c);

      const { data: rawItems } = await supabase
        .from("collection_items")
        .select("id, product_id, quantity, unit, installation_location, delivery_preference, installation_required, project_notes")
        .eq("collection_id", id);

      const fetchedItems = rawItems ?? [];
      setItems(fetchedItems);

      const fetchedProds = await fetchProductsByIds(fetchedItems.map((i) => i.product_id));
      setProducts(fetchedProds);

      // If owned by user, fetch their other collections for history reference
      if (user) {
        const hist = await getUserCollectionHistory(user.id);
        setOtherCollections(hist.filter((h: any) => h.id !== id));
      }
      setLoaded(true);
    };
    if (user || isAdmin) {
      load();
    }
  }, [id, user, isAdmin]);

  if (authLoading || (!loaded && (user || isAdmin))) {
    return <div className="container-app py-10 text-sm text-muted-foreground">Loading collection workspace…</div>;
  }

  // Access Control: Customer can only see their own collections
  if (user && collection && collection.user_id && collection.user_id !== user.id && !isAdmin) {
    return (
      <div className="container-app py-12 max-w-md text-center space-y-4">
        <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto" />
        <h2 className="font-display text-xl font-bold">Access Restricted</h2>
        <p className="text-xs text-muted-foreground">This project collection belongs to another client workspace.</p>
        <div className="pt-2 flex justify-center gap-3">
          <Link to="/my-collections" className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90">
            View My Collections
          </Link>
          <Link to="/" className="rounded-md border border-border px-4 py-2 text-xs font-bold hover:bg-muted">
            Back to Showroom
          </Link>
        </div>
      </div>
    );
  }

  const itemsWithDetails = products.map((p) => {
    const itemData = items.find((i) => i.product_id === p.id) || {};
    const unit = itemData.unit || detectProductUnit(p);
    const qty = itemData.quantity || 1;
    return {
      ...p,
      itemQty: qty,
      itemUnit: unit,
      location: itemData.installation_location,
      delivery: itemData.delivery_preference,
      installation: itemData.installation_required,
      notes: itemData.project_notes
    };
  });

  const formattedDate = collection?.submitted_at || collection?.created_at
    ? new Date(collection.submitted_at || collection.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "Recent";

  const message = [
    `Hi! I'd like to inquire about this Project Collection: ${collection?.name || "Collection"} ${collection?.version > 1 ? `(v${collection.version})` : ""}`,
    `Shared Link: ${typeof window !== "undefined" ? window.location.href : ""}`,
    "",
    "Selected Products:",
    ...itemsWithDetails.map((p, idx) => `${idx + 1}. ${p.name} (Code: ${p.code}) — ${p.itemQty} ${p.itemUnit}`),
  ].join("\n");

  return (
    <div className="container-app py-6 space-y-6">
      {/* Top Action Bar: Return & Continue Building */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Link to="/my-collections" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium">
            <ArrowLeft className="h-3.5 w-3.5" /> All Collections
          </Link>
          <span className="text-muted-foreground/40">•</span>
          <span className="text-xs text-primary font-bold uppercase tracking-wider">Customer Collection Workspace</span>
        </div>

        {/* Prominent Continue Building button linking back to Storefront Feed */}
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Continue Building Collection
          </Link>
          {settings?.sales_whatsapp && (
            <a
              href={waLink(settings.sales_whatsapp, message)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-xs"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Inquire on WhatsApp
            </a>
          )}
        </div>
      </div>

      {/* Primary Submitted Collection Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold">{collection?.project_name || collection?.name || "Submitted Project Collection"}</h1>
              {collection?.reference_number && (
                <span className="rounded-md bg-muted text-foreground text-xs font-mono font-bold px-2.5 py-1 border border-border">
                  {collection.reference_number}
                </span>
              )}
              {collection?.version && collection.version > 1 && (
                <span className="rounded-full bg-primary/10 text-primary text-xs font-semibold px-2.5 py-0.5 border border-primary/20">
                  v{collection.version}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 text-xs font-medium px-2.5 py-0.5 border border-amber-500/20">
                <Lock className="h-3 w-3" /> {collection?.status || "Submitted Request"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Submitted on <strong className="text-foreground font-mono">{formattedDate}</strong> • {products.length} product{products.length === 1 ? "" : "s"} specified
            </p>
          </div>
        </div>

      <ul className="mt-6 space-y-3">
        {itemsWithDetails.map((p) => (
          <li key={p.id} className="rounded-xl border border-border bg-card overflow-hidden p-4 shadow-sm">
            <div className="flex items-start sm:items-center gap-3">
              <Link to="/product/$slug" params={{ slug: p.slug }} className="block h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted border border-border/40">
                <img src={publicImageUrl(p.generated_studio_image) || publicImageUrl(p.image_url) || ""} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link to="/product/$slug" params={{ slug: p.slug }} className="block truncate font-semibold text-base hover:text-primary">
                  {p.name}
                </Link>
                <p className="text-xs text-muted-foreground">Code · {p.code}</p>
                {p.location && (
                  <p className="text-xs text-primary font-medium mt-0.5">Location: {p.location}</p>
                )}
              </div>

              <div className="text-right">
                <div className="text-sm font-bold">₦{Number(p.price).toLocaleString()}</div>
                <span className="inline-block mt-1 rounded-full bg-primary/10 text-primary text-xs font-semibold px-2.5 py-0.5">
                  {p.itemQty} {p.itemUnit}
                </span>
              </div>
            </div>

            {(p.delivery || p.installation || p.notes) && (
              <div className="mt-3 pt-3 border-t border-border/60 text-xs grid grid-cols-1 sm:grid-cols-3 gap-2 text-muted-foreground">
                {p.delivery && <div><strong className="text-foreground">Delivery:</strong> {p.delivery}</div>}
                {p.installation && <div><strong className="text-foreground">Installation:</strong> {p.installation}</div>}
                {p.notes && <div className="sm:col-span-3"><strong className="text-foreground">Notes:</strong> {p.notes}</div>}
              </div>
            )}
          </li>
        ))}
      </ul>
      </div>

      {/* Previous Submissions & Revisions History */}
      {otherCollections.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <History className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">Your Previous Project Submissions ({otherCollections.length})</h2>
          </div>
          <div className="divide-y divide-border/60">
            {otherCollections.map((hist: any) => {
              const histDate = hist.submitted_at || hist.created_at
                ? new Date(hist.submitted_at || hist.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                : "Previous";
              return (
                <div key={hist.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 first:pt-0 last:pb-0">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm">{hist.project_name || hist.name || "Submitted Collection"}</span>
                      {hist.reference_number && (
                        <span className="rounded bg-muted text-muted-foreground text-[11px] font-mono px-2 py-0.5 border border-border">
                          {hist.reference_number}
                        </span>
                      )}
                      {hist.version && hist.version > 1 && (
                        <span className="rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.2 border border-primary/20">
                          v{hist.version}
                        </span>
                      )}
                      <span className="rounded-full bg-secondary text-secondary-foreground text-[10px] px-2 py-0.2 capitalize">
                        {hist.status || "Submitted"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Submitted on <span className="font-medium text-foreground">{histDate}</span>
                    </p>
                  </div>
                  <Link
                    to="/collection/$id"
                    params={{ id: hist.id }}
                    className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition"
                  >
                    View Project & Products →
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
