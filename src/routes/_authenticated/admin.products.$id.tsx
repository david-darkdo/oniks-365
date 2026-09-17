import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Trash2, Globe, Search, ChevronDown, ChevronUp, Image, Layers, Cpu, ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { runProductPipeline } from "@/lib/ai-pipeline.functions";
import { generateStandaloneLifestyleImage } from "@/lib/lifestyle-image.functions";
import { runProductDetailsEngine } from "@/lib/product-details.functions";
import { slugify } from "@/lib/slug";
import { ImageUploader, ImageTile, publicImageUrl } from "@/components/ImageUploader";
import { ImageEditorModal } from "@/components/ImageEditorModal";
import { triggerSitemapUpdate } from "@/lib/seo-publisher";

export const Route = createFileRoute("/_authenticated/admin/products/$id")({
  component: RebuiltEditProductPage,
});

type Tax = { id: string; name: string };
type Cat = Tax & { type_id: string };
type Sub = Tax & { category_id: string };
type Fam = Tax & { subcategory_id: string };

function RebuiltEditProductPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [p, setP] = useState<any>(null);
  const [types, setTypes] = useState<(Tax & { code_prefix?: string })[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [fams, setFams] = useState<Fam[]>([]);

  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [generatingDetails, setGeneratingDetails] = useState(false);
  const [generatingLifestyle, setGeneratingLifestyle] = useState(false);
  const [runningPipeline, setRunningPipeline] = useState(false);

  // Photo Editor Modal State
  const [editingImage, setEditingImage] = useState<{ url: string; target: "image_url" | "generated_installed_image" } | null>(null);

  // Collapsible section toggles (Default Collapsed)
  const [showAdvancedAi, setShowAdvancedAi] = useState(false);
  const [showSeoSection, setShowSeoSection] = useState(false);
  const [showSearchSection, setShowSearchSection] = useState(false);

  const runDetailsFn = useServerFn(runProductDetailsEngine);
  const generateLifestyleFn = useServerFn(generateStandaloneLifestyleImage);
  const runPipelineFn = useServerFn(runProductPipeline);

  const [installationAssets, setInstallationAssets] = useState<any[]>([]);

  const load = useCallback(async () => {
    const [pRes, assetsRes] = await Promise.all([
      supabase.from("products").select("*").eq("id", id).maybeSingle(),
      supabase.from("product_assets").select("*").eq("product_id", id).eq("asset_type", "installed").order("created_at", { ascending: false }),
    ]);

    if (pRes.error) return toast.error(pRes.error.message);
    if (!pRes.data) return toast.error("Product not found");
    const data = pRes.data;
    if (!data.canonical_slug && data.name) {
      data.canonical_slug = slugify(data.name);
    }
    if (!data.master_document?.alternative_names || data.master_document.alternative_names.length === 0) {
      const fallbackAlts = data.ai_understanding?.alternative_names && data.ai_understanding.alternative_names.length > 0
        ? data.ai_understanding.alternative_names
        : [];
      if (fallbackAlts.length > 0) {
        data.master_document = { ...(data.master_document || {}), alternative_names: fallbackAlts };
      }
    }
    setP(data);
    setInstallationAssets(assetsRes.data || []);
  }, [id]);

  const handleAddInstallationImages = async (paths: string[]) => {
    for (const path of paths) {
      await supabase.from("product_assets").insert({
        product_id: id,
        asset_type: "installed",
        asset_url: path,
        generated_by_ai: false,
      });
      if (!p.generated_installed_image) {
        await supabase.from("products").update({ generated_installed_image: path } as any).eq("id", id);
      }
    }
    toast.success("Added installation images!");
    await load();
  };

  const handleDeleteInstallationAsset = async (assetId: string) => {
    await supabase.from("product_assets").delete().eq("id", assetId);
    toast.success("Removed installation image");
    await load();
  };

  useEffect(() => {
    load();
    (async () => {
      const [t, c, s, f] = await Promise.all([
        supabase.from("product_types").select("id,name").order("name"),
        supabase.from("categories").select("id,name,type_id").order("name"),
        supabase.from("subcategories").select("id,name,category_id").order("name"),
        supabase.from("family_groups").select("id,name,subcategory_id").order("name"),
      ]);
      setTypes((t.data ?? []) as any);
      setCats((c.data ?? []) as any);
      setSubs((s.data ?? []) as any);
      setFams((f.data ?? []) as any);
    })();
  }, [id, load]);

  const filteredCats = useMemo(() => cats.filter((c) => c.type_id === p?.type_id), [cats, p?.type_id]);
  const filteredSubs = useMemo(() => subs.filter((s) => s.category_id === p?.category_id), [subs, p?.category_id]);
  const filteredFams = useMemo(() => fams.filter((f) => f.subcategory_id === p?.subcategory_id), [fams, p?.subcategory_id]);

  if (!p) return <div className="container-app py-10 text-sm text-muted-foreground font-mono">Loading product data…</div>;

  const setField = (key: string, value: any) => {
    setP((prev: any) => {
      const next = { ...prev, [key]: value };
      // CRITICAL SYNC RULE: Product Description = SEO Description
      if (key === "short_description" || key === "generated_description") {
        next.short_description = value;
        next.generated_description = value;
        next.seo_description = value;
      } else if (key === "seo_description") {
        next.seo_description = value;
        next.short_description = value;
        next.generated_description = value;
      }
      return next;
    });
    setIsDirty(true);
  };

  // ENGINE 1 Execution
  const handleGenerateDetails = async () => {
    setGeneratingDetails(true);
    try {
      const res = await runDetailsFn({ data: { productId: id } });
      if (res.ok) {
        toast.success("Engine 1: Product details & SEO description generated!");
        await load();
      } else {
        toast.error("Failed to generate product details.");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Generation failed");
    } finally {
      setGeneratingDetails(false);
    }
  };

  // ENGINE 2 Execution
  const handleGenerateLifestyle = async () => {
    if (!p.image_url) {
      toast.error("Original product image is required before generating an installed image.");
      return;
    }
    setGeneratingLifestyle(true);
    try {
      const res = await generateLifestyleFn({ data: { productId: id } });
      if (res.ok && res.imageUrl) {
        toast.success("Engine 2: Installed lifestyle photo generated!");
        await load();
      } else {
        toast.error("Failed to generate lifestyle photo.");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Generation failed");
    } finally {
      setGeneratingLifestyle(false);
    }
  };

  // Full Pipeline Runner
  const handleRunFullPipeline = async () => {
    setRunningPipeline(true);
    try {
      const res = await runPipelineFn({ data: { productId: id } });
      if (res.ok) {
        toast.success("Full AI pipeline completed!");
        await load();
      } else {
        toast.error("Pipeline run completed with notices.");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Pipeline failed");
    } finally {
      setRunningPipeline(false);
    }
  };

  // SAVE HANDLER
  const save = async () => {
    setSaving(true);
    const syncedDesc = p.seo_description || p.short_description || p.generated_description || null;
    const finalCanonicalSlug = slugify(p.canonical_slug || p.slug) || slugify(p.name) || `product-${p.code || id.slice(0, 8)}`;
    let currentMasterDoc = p.master_document || {};
    if (!currentMasterDoc.alternative_names || currentMasterDoc.alternative_names.length === 0) {
      const lower = (p.name || "").toLowerCase();
      let altFallback: string[] = [];
      if (lower.includes("sink") || lower.includes("bowl")) {
        altFallback = ["Double Bowl Sink", "Two Compartment Sink", "Stainless Kitchen Basin", "Modern Kitchen Sink"];
      } else if (lower.includes("toilet") || lower.includes("wc")) {
        altFallback = ["Water Closet", "Commode", "Wall-Hung Toilet", "Bathroom WC"];
      } else if (lower.includes("basin") || lower.includes("wash")) {
        altFallback = ["Wash Hand Basin", "Wash Sink", "Vanity Basin", "Countertop Basin"];
      } else if (lower.includes("mixer") || lower.includes("valve") || lower.includes("tap")) {
        altFallback = ["Shower Valve", "Thermostatic Tap", "Concealed Mixer", "Bathroom Faucet"];
      } else if (lower.includes("tile") || lower.includes("porcelain")) {
        altFallback = ["Floor Tile", "Wall Tile", "Porcelain Tile"];
      } else if (p.name) {
        altFallback = [p.name];
      }
      currentMasterDoc = { ...currentMasterDoc, alternative_names: altFallback };
    }

    const payload = {
      ...p,
      canonical_slug: finalCanonicalSlug,
      slug: finalCanonicalSlug,
      short_description: syncedDesc,
      generated_description: syncedDesc,
      seo_description: syncedDesc,
      master_document: currentMasterDoc,
      ai_understanding: currentMasterDoc,
      is_published: p.status === "published",
      price: Number(p.price) || 0,
      original_price: p.original_price ? Number(p.original_price) : null,
      pricing_unit: p.pricing_unit || "piece",
      differentiator_type: p.differentiator_type || null,
      differentiator_note: (p.differentiator_note || "").trim() || null,
      processing_state: "completed",
    };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    delete payload.similar_product_ids;

    const { error } = await supabase.from("products").update(payload as any).eq("id", id);
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    // Rebuild search index & trigger SEO discovery sitemap update
    await supabase.rpc("rebuild_search_index" as any, { _product_id: id } as any);
    await triggerSitemapUpdate(id);

    setSaving(false);
    setIsDirty(false);
    toast.success("Product changes saved, search index & sitemaps updated!");
    await load();
  };

  const arrToStr = (v: any) => (Array.isArray(v) ? v.join(", ") : v ?? "");
  const strToArr = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="container-app py-6 max-w-5xl space-y-6">
      {/* Header Navigation & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <Link to="/admin/products" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to library
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground uppercase">{p.name || "Edit Product"}</h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">ID: {id} · Code: {p.code}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="rounded bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/95 transition shadow-sm"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* SECTION 1: Product Information */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Layers className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Section 1 — Product Information</h2>
        </div>

        {/* Classification Hierarchy */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Product Type *</label>
            <select
              value={p.type_id || ""}
              onChange={(e) => setField("type_id", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            >
              <option value="">Select Type…</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category *</label>
            <select
              value={p.category_id || ""}
              onChange={(e) => setField("category_id", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            >
              <option value="">Select Category…</option>
              {filteredCats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subcategory *</label>
            <select
              value={p.subcategory_id || ""}
              onChange={(e) => setField("subcategory_id", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            >
              <option value="">Select Subcategory…</option>
              {filteredSubs.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Family Group *</label>
            <select
              value={p.family_id || ""}
              onChange={(e) => setField("family_id", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            >
              <option value="">Select Family…</option>
              {filteredFams.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Product Fields */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Product Name *</label>
            <input
              type="text"
              value={p.name || ""}
              onChange={(e) => setField("name", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Product Code</label>
            <input
              type="text"
              value={p.code || ""}
              onChange={(e) => setField("code", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs font-mono"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Brand</label>
            <input
              type="text"
              value={p.brand || ""}
              onChange={(e) => setField("brand", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Price (NGN) *</label>
            <input
              type="number"
              value={p.price || 0}
              onChange={(e) => setField("price", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Original Price (NGN)</label>
            <input
              type="number"
              placeholder="Optional regular price"
              value={p.original_price ?? ""}
              onChange={(e) => setField("original_price", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pricing Unit *</label>
            <select
              value={p.pricing_unit || "piece"}
              onChange={(e) => setField("pricing_unit", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            >
              <option value="piece">piece</option>
              <option value="set">set</option>
              <option value="unit">unit</option>
              <option value="sqm">sqm (m²)</option>
              <option value="carton">carton</option>
              <option value="box">box</option>
              <option value="metre">metre</option>
              <option value="roll">roll</option>
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Size / Dimension</label>
            <input
              type="text"
              value={p.size || ""}
              onChange={(e) => setField("size", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Finish</label>
            <input
              type="text"
              value={p.finish_name || p.finish || ""}
              onChange={(e) => setField("finish_name", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Material</label>
            <input
              type="text"
              value={p.material || ""}
              onChange={(e) => setField("material", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Color</label>
            <input
              type="text"
              value={p.color || ""}
              onChange={(e) => setField("color", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Differentiator Type</label>
            <select
              value={p.differentiator_type || ""}
              onChange={(e) => setField("differentiator_type", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            >
              <option value="">None (Standard)</option>
              <option value="Design Style">Design Style</option>
              <option value="Material">Material</option>
              <option value="Finish">Finish</option>
              <option value="Format">Format</option>
              <option value="Installation">Installation</option>
              <option value="Performance">Performance</option>
              <option value="Function">Function</option>
              <option value="Collection">Collection</option>
              <option value="Brand">Brand</option>
              <option value="Application">Application</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Differentiator Note</label>
              <span className="text-[9px] text-muted-foreground">{(p.differentiator_note || "").length}/80</span>
            </div>
            <input
              type="text"
              maxLength={80}
              placeholder="e.g. Double Bowl Waterfall Tap / Wall-Hung Rimless"
              value={p.differentiator_note || ""}
              onChange={(e) => setField("differentiator_note", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
        </div>
      </section>

      {/* SECTION 2: Images */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Image className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Section 2 — Images</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Original Manufacturer Image (FIXED SOURCE OF TRUTH) */}
          <div className="space-y-3 bg-muted/20 border border-border p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-600">Original Manufacturer Image *</label>
              <span className="text-[10px] text-muted-foreground font-semibold">Source of Truth</span>
            </div>
            {p.image_url ? (
              <ImageTile
                url={publicImageUrl(p.image_url) || p.image_url}
                onDelete={() => setField("image_url", null)}
                onEdit={() => setEditingImage({ url: publicImageUrl(p.image_url) || p.image_url, target: "image_url" })}
                badge="Original Source of Truth"
              />
            ) : (
              <ImageUploader multiple={false} onUploaded={(paths) => setField("image_url", paths[0])} label="Upload Original Product Image" />
            )}
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              This fixed original manufacturer image is the single source of truth for the product and is never overwritten or turned into a carousel.
            </p>
          </div>

          {/* Installation Images (MULTIPLE SWITCHABLE GALLERY) */}
          <div className="space-y-3 bg-muted/20 border border-border p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-600">Installation Gallery ({installationAssets.length + (p.generated_installed_image ? 1 : 0)})</label>
              <span className="text-[10px] text-muted-foreground font-semibold">Multiple Switchable Images</span>
            </div>

            {/* List of Installation Images */}
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {p.generated_installed_image && (
                <ImageTile
                  url={publicImageUrl(p.generated_installed_image) || p.generated_installed_image}
                  onDelete={() => setField("generated_installed_image", null)}
                  onEdit={() => setEditingImage({ url: publicImageUrl(p.generated_installed_image) || p.generated_installed_image, target: "generated_installed_image" })}
                  badge="Primary Installed Scene"
                />
              )}
              {installationAssets.map((asset, idx) => (
                <ImageTile
                  key={asset.id || idx}
                  url={publicImageUrl(asset.asset_url) || asset.asset_url}
                  onDelete={() => handleDeleteInstallationAsset(asset.id)}
                  badge={`Installation ${idx + 1}`}
                />
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <ImageUploader multiple={true} onUploaded={handleAddInstallationImages} label="Add Installation Images to Gallery" />

              <button
                type="button"
                onClick={handleGenerateLifestyle}
                disabled={generatingLifestyle || !p.image_url}
                className="w-full flex items-center justify-center gap-2 rounded border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {generatingLifestyle ? "Engine 2 Generating Installed Image…" : "Generate AI Installed Image (Engine 2)"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Publishing */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Section 3 — Publishing Settings</h2>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <select
              value={p.status || "published"}
              onChange={(e) => setField("status", e.target.value)}
              className="rounded-md border border-input bg-background p-2 text-xs font-semibold"
            >
              <option value="published">Status: Published</option>
              <option value="draft">Status: Draft</option>
              <option value="review">Status: Review</option>
              <option value="archived">Status: Archived</option>
            </select>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/95 transition shadow-sm"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </section>

      {/* SECTION 4: Advanced AI (Collapsed by default) */}
      <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvancedAi(!showAdvancedAi)}
          className="w-full flex items-center justify-between p-5 bg-card hover:bg-muted/40 transition text-left"
        >
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Section 4 — Advanced AI Operations</h2>
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono">Engine 1 & Engine 2</span>
          </div>
          {showAdvancedAi ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {showAdvancedAi && (
          <div className="p-5 border-t border-border space-y-4 bg-muted/10">
            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={handleGenerateDetails}
                disabled={generatingDetails}
                className="flex items-center justify-center gap-2 rounded border border-primary/40 bg-primary/10 px-4 py-3 text-xs font-bold text-primary hover:bg-primary/20 transition disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {generatingDetails ? "Generating Details…" : "Generate Product Details (Engine 1)"}
              </button>

              <button
                type="button"
                onClick={handleGenerateLifestyle}
                disabled={generatingLifestyle || !p.image_url}
                className="flex items-center justify-center gap-2 rounded border border-primary/40 bg-primary/10 px-4 py-3 text-xs font-bold text-primary hover:bg-primary/20 transition disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {generatingLifestyle ? "Generating Installed Image…" : "Generate Installed Image (Engine 2)"}
              </button>

              <button
                type="button"
                onClick={handleRunFullPipeline}
                disabled={runningPipeline}
                className="flex items-center justify-center gap-2 rounded bg-primary px-4 py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/95 transition shadow-sm disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {runningPipeline ? "Running Full Pipeline…" : "Run Full Pipeline"}
              </button>
            </div>

            {/* AI Status & Log */}
            <div className="rounded-lg border border-border bg-background p-3 text-xs space-y-2 font-mono text-muted-foreground">
              <div className="flex items-center justify-between text-foreground font-semibold">
                <span>AI State: {p.processing_state || "completed"}</span>
                <span className="text-[10px] text-primary">{p.last_processed_at ? new Date(p.last_processed_at).toLocaleString() : "Never"}</span>
              </div>
              {p.error_log ? (
                <p className="text-[11px] text-destructive">{typeof p.error_log === "object" ? JSON.stringify(p.error_log) : p.error_log}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">Product details engine synced. Ready for publishing.</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* SECTION 5: SEO (Collapsed by default) */}
      <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSeoSection(!showSeoSection)}
          className="w-full flex items-center justify-between p-5 bg-card hover:bg-muted/40 transition text-left"
        >
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Section 5 — Google SEO & Metadata</h2>
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono">Product Desc == SEO Desc</span>
          </div>
          {showSeoSection ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {showSeoSection && (
          <div className="p-5 border-t border-border space-y-4 bg-muted/10">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">SEO Title</label>
              <input
                type="text"
                value={p.seo_title || ""}
                onChange={(e) => setField("seo_title", e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">SEO Description & Product Description (Synced)</label>
                <span className="text-[9px] text-primary font-semibold">Critical Sync Rule Active</span>
              </div>
              <textarea
                rows={3}
                value={p.seo_description || p.short_description || p.generated_description || ""}
                onChange={(e) => setField("seo_description", e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs leading-relaxed"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">SEO Keywords (Comma Separated)</label>
                <input
                  type="text"
                  value={arrToStr(p.seo_keywords)}
                  onChange={(e) => setField("seo_keywords", strToArr(e.target.value))}
                  className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Canonical Slug</label>
                <input
                  type="text"
                  value={p.canonical_slug || slugify(p.name) || ""}
                  onChange={(e) => setField("canonical_slug", slugify(e.target.value))}
                  className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 6: Search Intelligence (Collapsed by default) */}
      <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSearchSection(!showSearchSection)}
          className="w-full flex items-center justify-between p-5 bg-card hover:bg-muted/40 transition text-left"
        >
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Section 6 — Search Intelligence Index</h2>
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono">Showroom & Full Text</span>
          </div>
          {showSearchSection ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {showSearchSection && (
          <div className="p-5 border-t border-border space-y-4 bg-muted/10">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Search Keywords</label>
              <textarea
                rows={2}
                value={arrToStr(p.app_keywords || p.app_search_keywords || p.master_document?.google_search_tags)}
                onChange={(e) => setField("app_keywords", strToArr(e.target.value))}
                className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Alternative Names</label>
              <textarea
                rows={2}
                value={arrToStr(
                  p.master_document?.alternative_names && p.master_document.alternative_names.length > 0
                    ? p.master_document.alternative_names
                    : (p.ai_understanding?.alternative_names || [])
                )}
                onChange={(e) => {
                  const arr = strToArr(e.target.value);
                  const nextDoc = { ...(p.master_document || {}), alternative_names: arr };
                  setField("master_document", nextDoc);
                }}
                className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Synonyms & Customer Phrases</label>
              <textarea
                rows={2}
                value={arrToStr(p.master_document?.customer_search_phrases || p.master_document?.search_synonyms)}
                onChange={(e) => {
                  const arr = strToArr(e.target.value);
                  const nextDoc = { ...(p.master_document || {}), customer_search_phrases: arr, search_synonyms: arr };
                  setField("master_document", nextDoc);
                }}
                className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Related Terms</label>
              <textarea
                rows={2}
                value={arrToStr(p.master_document?.related_search_terms)}
                onChange={(e) => {
                  const arr = strToArr(e.target.value);
                  const nextDoc = { ...(p.master_document || {}), related_search_terms: arr };
                  setField("master_document", nextDoc);
                }}
                className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Common Misspellings</label>
              <textarea
                rows={2}
                value={arrToStr(p.master_document?.common_misspellings)}
                onChange={(e) => {
                  const arr = strToArr(e.target.value);
                  const nextDoc = { ...(p.master_document || {}), common_misspellings: arr };
                  setField("master_document", nextDoc);
                }}
                className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
              />
            </div>
          </div>
        )}
      </section>

      {/* Image Editor Modal (Crop, Rotate, Flip) */}
      {editingImage && (
        <ImageEditorModal
          isOpen={!!editingImage}
          imageUrl={editingImage.url}
          productId={p?.id}
          onClose={() => setEditingImage(null)}
          onSave={async (newUrl) => {
            const targetField = editingImage.target;
            setField(targetField, newUrl);
            if (p?.id) {
              await supabase
                .from("products")
                .update({ [targetField]: newUrl } as any)
                .eq("id", p.id);
              toast.success("Edited photo permanently saved to product database!");
            }
          }}
        />
      )}
    </div>
  );
}
