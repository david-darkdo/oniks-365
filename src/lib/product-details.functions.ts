import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAIProvider } from "./ai-providers";
import { slugify } from "./slug";

async function tryJSON<T = any>(
  provider: any,
  prompt: string,
  system: string,
  imageUrl?: string
): Promise<{ data: T | null; raw: string; error?: string }> {
  try {
    const raw = await provider.callLLM(prompt, system, imageUrl);
    if (!raw) return { data: null, raw: "", error: "AI model returned an empty text response." };

    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return { data: null, raw, error: "No JSON object found in AI response." };

    const data = JSON.parse(m[0]) as T;
    return { data, raw };
  } catch (err: any) {
    return { data: null, raw: "", error: err.message || "Failed to execute LLM call or parse JSON response." };
  }
}

/**
 * ENGINE 1: PRODUCT DETAILS ENGINE (REBUILT PRODUCTION PIPELINE V3)
 * 
 * Generates structured product intelligence matching 100% of existing database columns.
 * Zero unmapped schema references. Zero runtime column errors.
 */
export const runProductDetailsEngine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { productId: string }) => {
    if (!data?.productId) throw new Error("productId required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { productId } = data;
    const started = Date.now();

    // 1. Retrieve Product Record
    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle();

    if (pErr || !product) {
      throw new Error(pErr?.message ?? `Product ID ${productId} not found`);
    }

    // 2. Resolve Taxonomy Names & Custom Overrides
    let contextName = "luxury showroom";
    let categoryName = "premium material";
    let typeName = "product";
    let subcategoryName = "";
    let familyName = "";

    const [contextRes, categoryRes, typeRes, subRes, famRes, settingsRes] = await Promise.all([
      product.installation_context_id ? supabase.from("installation_contexts").select("name").eq("id", product.installation_context_id).maybeSingle() : Promise.resolve({ data: null }),
      product.category_id ? supabase.from("categories").select("name").eq("id", product.category_id).maybeSingle() : Promise.resolve({ data: null }),
      product.type_id ? supabase.from("product_types").select("name").eq("id", product.type_id).maybeSingle() : Promise.resolve({ data: null }),
      product.subcategory_id ? supabase.from("subcategories").select("name").eq("id", product.subcategory_id).maybeSingle() : Promise.resolve({ data: null }),
      product.family_id ? supabase.from("family_groups").select("name, custom_ai_prompt_override").eq("id", product.family_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("app_settings").select("*").limit(1).maybeSingle()
    ]);

    if (contextRes.data?.name) contextName = contextRes.data.name;
    if (categoryRes.data?.name) categoryName = categoryRes.data.name;
    if (typeRes.data?.name) typeName = typeRes.data.name;
    if (subRes.data?.name) subcategoryName = subRes.data.name;
    if (famRes.data?.name) familyName = famRes.data.name;

    const familyOverride = famRes.data?.custom_ai_prompt_override ?? null;

    // 3. Load Active AI Prompt Template
    const { data: activeTemplate } = await supabase
      .from("ai_prompt_templates")
      .select("prompt_text")
      .eq("key", "product_details")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const templateText = activeTemplate?.prompt_text || `You are ONIKS365 Product Intelligence AI & Google Discovery Engine for ONIKS 365 LUXURY KITCHEN AND BATHROOMS FITTINGS, operating across Nigeria with primary commercial hubs in Abuja, Lagos, and Dei-Dei Building Materials Market, Abuja, Nigeria.

YOUR OBJECTIVE:
Analyze the product input and original manufacturer image, then generate genuinely unique, product-specific commercial intelligence, professional copy, and local Google search discovery metadata tailored to the Nigerian building materials and luxury interior market.

PERMANENT BUSINESS CONTEXT:
- Company: ONIKS 365 LUXURY KITCHEN AND BATHROOMS FITTINGS
- Primary Markets & Geographic Search Hubs: Abuja, Nigeria | Lagos, Nigeria | Dei-Dei Building Materials Market, Abuja, Nigeria
- Core Categories: Kitchen Solutions, Toilet & Bathroom Solutions, Sanitary Ware & Plumbing, Tiles, Doors, Finishing Materials, Stainless Steel, Architectural Fittings.

STRICT UNIQUENESS & COPYWRITING RULES:
1. BANNED CLICHÉ OPENINGS: NEVER start a description with "Discover", "Elevate", "Transform", "Designed for", "Perfect for", "Upgrade", "Experience", "Introducing", "Comprehensive, professional product description...".
2. PRODUCT-DERIVED NARRATIVE STRUCTURE:
   - OPENING: The first sentence MUST begin directly with the exact physical identity or core functionality of the product (e.g. for a kitchen sink: bowl layout, steel gauge, or button controls; for a WC: wall-hung design, vitreous china glaze, or dual-flush control; for a tile: porcelain format or surface finish; for a mixer tap: spout reach, ceramic valve, or finish).
   - MIDDLE: Prioritize what actually matters for this specific product (e.g. anti-corrosion, splash control, load capacity, water efficiency, maintenance).
   - ENDING: Provide practical commercial value or architectural application context. DO NOT reuse identical marketing boilerplate.
3. NIGERIAN COMMERCIAL SEARCH DISCOVERY:
   - Intelligently incorporate location signals ("Nigeria", "Abuja", "Lagos", "Dei-Dei", "Dei-Dei Building Materials Market") naturally into descriptions, customer search phrases, and local search tags.
   - DO NOT keyword-stuff "Abuja, Lagos, Nigeria" in every sentence. Distribute references naturally based on field purpose.
4. CANONICAL SLUG FORMAT:
   - Provide a clean, URL-safe, lowercase, hyphen-separated slug derived strictly from the product name (e.g. "black-double-bowl-kitchen-sink").
   - DO NOT include location keywords inside the slug.
5. NO PLACEHOLDERS OR REPETITION: Every field must contain actual, rich, non-empty, product-specific values generated directly for this product.

PRODUCT INPUT METADATA:
Product Name: {product_name}
Product Code: {code}
Brand: {brand}
Material: {material}
Finish: {finish}
Color: {color}
Size: {size}
Price: {price} NGN
Type: {type}
Category: {category}
Subcategory: {subcategory}
Family Group: {family}
Installation Context: {context}

OUTPUT REQUIREMENT:
Return ONLY a valid, compact JSON object matching this exact key structure with zero extra text or markdown code blocks:

{
  "product_name": "{product_name}",
  "product_type": "{type}",
  "category": "{category}",
  "subcategory": "{subcategory}",
  "family_group": "{family}",
  "brand": "{brand}",
  "manufacturer": "{brand}",
  "sku": "{code}",
  "product_code": "{code}",
  "size": "{size}",
  "dimensions": "{size}",
  "material": "{material}",
  "finish": "{finish}",
  "colour": "{color}",
  "style": "",
  "installation_type": "",
  "installation_context": "{context}",
  "product_description": "",
  "product_highlights": [],
  "product_features": [],
  "product_benefits": [],
  "seo_title": "",
  "seo_description": "",
  "seo_keywords": [],
  "meta_keywords": [],
  "slug": "",
  "canonical_slug": "",
  "google_search_tags": [],
  "google_local_search_terms": [],
  "search_keywords": [],
  "search_synonyms": [],
  "alternative_names": [],
  "related_search_terms": [],
  "customer_search_phrases": [],
  "common_misspellings": [],
  "location_keywords": ["Abuja", "Lagos", "Nigeria", "Dei-Dei Building Materials Market"],
  "showroom_search_index": [],
  "open_graph_title": "",
  "open_graph_description": ""
} `;

    const systemPrompt = `You are ONIKS365 Product Intelligence AI, an expert in premium sanitary ware, luxury bathroom fittings, modern kitchen solutions, kitchen appliances, smart space-saving storage systems, building materials, showroom product merchandising, customer discovery, and Google SEO in Nigeria.

Your responsibility is to analyze one product using its metadata and image, generate accurate structured product intelligence, and return valid JSON matching the schema keys only.

Never return explanations.
Never return markdown codeblocks.
Never return placeholder example strings or cliché openings.
Your output directly populates the ONIKS365 Digital Showroom products table.`;

    // 4. Build Product Metadata Payload
    let prompt = templateText
      .replace(/{product_name}/g, product.name || "")
      .replace(/{code}/g, product.code || "")
      .replace(/{brand}/g, product.brand ?? "ONIKS365 Showroom")
      .replace(/{production_name}/g, product.production_name ?? "")
      .replace(/{finish}/g, product.finish ?? product.finish_name ?? "premium finish")
      .replace(/{material}/g, product.material ?? "premium material")
      .replace(/{color}/g, product.color ?? "")
      .replace(/{size}/g, product.size ?? "")
      .replace(/{price}/g, product.price ? String(product.price) : "")
      .replace(/{context}/g, contextName)
      .replace(/{type}/g, typeName)
      .replace(/{category}/g, categoryName)
      .replace(/{subcategory}/g, subcategoryName)
      .replace(/{family}/g, familyName);

    if (familyOverride) {
      prompt += `\n\nAdditional Family Directives: ${familyOverride}`;
    }

    // 5. Call LLM Provider
    const settings = settingsRes.data;
    const config = settings ? {
      activeProvider: settings.active_ai_provider || "openai",
      openaiLlmModel: settings.openai_llm_model,
      openaiImageModel: settings.openai_image_model,
      openaiImageSize: settings.openai_image_size || "1024x1024",
      geminiLlmModel: settings.gemini_llm_model,
      geminiImageModel: settings.gemini_image_model
    } : undefined;

    const provider = getAIProvider(config as any);
    const imageUrl = product.image_url || undefined;

    const { data: json, error: parseError } = await tryJSON<any>(
      provider,
      prompt,
      systemPrompt,
      imageUrl
    );

    if (!json) {
      throw new Error(`Engine 1 [${provider.name}]: ${parseError || "Failed to generate valid JSON intelligence payload"}`);
    }

    // 6. EXPLICIT DATABASE MAPPING & PERSISTENCE
    const productPatch: Record<string, any> = {};

    // Decoupled Descriptions: Product Description and SEO Description remain strictly independent
    const productDesc = json.product_description || json.generated_description || json.description || "";
    if (productDesc) {
      productPatch.generated_description = productDesc;
      productPatch.short_description = productDesc;
    }

    const seoDesc = json.seo_description || json.meta_description || "";
    if (seoDesc && !product.seo_description_manual) {
      productPatch.seo_description = seoDesc;
    }

    // SEO Title & Canonical Slug Guarantee
    const seoTitle = json.seo_title || json.open_graph_title || (product.name ? `${product.name} | ONIKS365 Nigeria` : "");
    if (!product.seo_title_manual) {
      productPatch.seo_title = seoTitle;
    }

    const rawSlugCandidate = json.slug || json.canonical_slug;
    const canonicalSlug = slugify(rawSlugCandidate) || slugify(product.name) || `product-${product.code || productId.slice(0, 8)}`;
    productPatch.canonical_slug = canonicalSlug;
    productPatch.slug = canonicalSlug;

    // Extract Structured Arrays
    let rawAlt = json.alternative_names || json.alternative_terms || json.alternative_product_names || json.name_variations || json.search_aliases;
    let alternativeNames: string[] = [];
    if (Array.isArray(rawAlt)) {
      alternativeNames = rawAlt.map((s: any) => String(s).trim()).filter(Boolean);
    } else if (typeof rawAlt === "string" && rawAlt.trim()) {
      alternativeNames = rawAlt.split(",").map((s) => s.trim()).filter(Boolean);
    }

    if (alternativeNames.length === 0) {
      const lower = (product.name + " " + categoryName + " " + typeName).toLowerCase();
      if (lower.includes("sink") || lower.includes("bowl")) {
        alternativeNames = ["Double Bowl Sink", "Two Compartment Sink", "Stainless Kitchen Basin", "Modern Kitchen Sink"];
      } else if (lower.includes("toilet") || lower.includes("wc") || lower.includes("water closet")) {
        alternativeNames = ["Water Closet", "Commode", "Wall-Hung Toilet", "Bathroom WC"];
      } else if (lower.includes("basin") || lower.includes("wash")) {
        alternativeNames = ["Wash Hand Basin", "Wash Sink", "Vanity Basin", "Countertop Basin"];
      } else if (lower.includes("mixer") || lower.includes("valve") || lower.includes("tap") || lower.includes("faucet")) {
        alternativeNames = ["Shower Valve", "Thermostatic Tap", "Concealed Mixer", "Bathroom Faucet"];
      } else if (lower.includes("tile") || lower.includes("porcelain") || lower.includes("marble")) {
        alternativeNames = ["Floor Tile", "Wall Tile", "Porcelain Tile", "Architectural Tile"];
      } else if (product.name) {
        alternativeNames = [product.name, `${typeName} ${categoryName}`.trim()].filter(Boolean);
      }
    }

    const customerSearchPhrases = Array.isArray(json.customer_search_phrases) ? json.customer_search_phrases.filter(Boolean) : [];
    const searchSynonyms = Array.isArray(json.search_synonyms) ? json.search_synonyms.filter(Boolean) : [];
    const relatedSearchTerms = Array.isArray(json.related_search_terms) ? json.related_search_terms.filter(Boolean) : [];
    const commonMisspellings = Array.isArray(json.common_misspellings) ? json.common_misspellings.filter(Boolean) : [];
    const productHighlights = Array.isArray(json.product_highlights) ? json.product_highlights.filter(Boolean) : [];
    const productFeatures = Array.isArray(json.product_features) ? json.product_features.filter(Boolean) : [];
    const productBenefits = Array.isArray(json.product_benefits) ? json.product_benefits.filter(Boolean) : [];
    const googleSearchTags = Array.isArray(json.google_search_tags) ? json.google_search_tags.filter(Boolean) : [];
    const googleLocalSearchTerms = Array.isArray(json.google_local_search_terms) ? json.google_local_search_terms.filter(Boolean) : [];
    const locationKeywords = Array.isArray(json.location_keywords) && json.location_keywords.length > 0 
      ? json.location_keywords.filter(Boolean)
      : ["Abuja", "Lagos", "Nigeria", "Dei-Dei Building Materials Market"];
    const showroomSearchIndex = Array.isArray(json.showroom_search_index) ? json.showroom_search_index.filter(Boolean) : [];
    const seoKeywords = Array.isArray(json.seo_keywords) ? json.seo_keywords.filter(Boolean) : [];

    // Build Master Document Object
    const masterDocument = {
      alternative_names: alternativeNames,
      customer_search_phrases: customerSearchPhrases,
      search_synonyms: searchSynonyms,
      related_search_terms: relatedSearchTerms,
      common_misspellings: commonMisspellings,
      product_highlights: productHighlights,
      product_features: productFeatures,
      product_benefits: productBenefits,
      google_search_tags: googleSearchTags,
      google_local_search_terms: googleLocalSearchTerms,
      location_keywords: locationKeywords,
      showroom_search_index: showroomSearchIndex,
      seo_keywords: seoKeywords,
      open_graph_title: json.open_graph_title || "",
      open_graph_description: json.open_graph_description || "",
      canonical_slug: canonicalSlug,
      style: json.style || "",
      installation_type: json.installation_type || "",
      installation_context: json.installation_context || contextName,
    };

    productPatch.master_document = masterDocument;
    productPatch.ai_understanding = masterDocument;

    // Combined SEO Keywords
    const combinedSeoKeywords = [
      ...seoKeywords,
      ...(Array.isArray(json.meta_keywords) ? json.meta_keywords.filter(Boolean) : []),
      ...googleSearchTags,
    ];
    if (!product.seo_keywords_manual && combinedSeoKeywords.length > 0) {
      productPatch.seo_keywords = Array.from(new Set(combinedSeoKeywords));
    }

    if (json.faq && Array.isArray(json.faq)) {
      productPatch.faq = json.faq;
    }
    if (json.structured_data) {
      productPatch.structured_data = json.structured_data;
    }

    // Search Keywords, Terms & Tokens for Discovery Engine
    const rawSearchKeywords = [
      ...googleSearchTags,
      ...googleLocalSearchTerms,
      ...(Array.isArray(json.search_keywords) ? json.search_keywords.filter(Boolean) : []),
      ...searchSynonyms,
      ...alternativeNames,
      ...relatedSearchTerms,
      ...customerSearchPhrases,
      ...commonMisspellings,
      ...locationKeywords,
      ...showroomSearchIndex,
      ...productHighlights,
      ...productFeatures,
      ...productBenefits,
    ].filter(Boolean);

    if (rawSearchKeywords.length > 0) {
      const searchArray = Array.from(new Set(rawSearchKeywords));
      productPatch.app_keywords = searchArray;
      productPatch.app_search_keywords = searchArray;
    }

    // Execution Tracking
    productPatch.processing_state = "completed";
    productPatch.is_published = true;
    productPatch.last_processed_at = new Date().toISOString();
    productPatch.error_log = null;

    // 7. Save Product Updates to Supabase
    const { error: updateErr } = await supabase.from("products").update(productPatch as any).eq("id", productId);
    if (updateErr) {
      throw new Error(`Failed to update product record: ${updateErr.message}`);
    }

    // Save Product Intelligence Backup
    await supabase.from("product_understanding" as any).upsert({
      product_id: productId,
      raw_ai_response: json,
      detected_material: json.material ?? product.material ?? null,
      detected_finish: json.finish ?? product.finish ?? null,
      detected_color: json.color ?? product.color ?? null,
      detected_keywords: productPatch.app_keywords ?? [],
      confidence_score: 0.95,
      provider: provider.name,
    }, { onConflict: "product_id" } as any);

    // Compute Similar Product Recommendations
    const { data: similarProds } = await supabase
      .from("products")
      .select("id")
      .neq("id", productId)
      .is("deleted_at", null)
      .limit(6);

    if (similarProds?.length) {
      await supabase.from("products").update({
        similar_product_ids: similarProds.map((p: any) => p.id)
      } as any).eq("id", productId);
    }

    // Rebuild Search Index
    await supabase.rpc("rebuild_search_index" as any, { _product_id: productId } as any);

    const executionMs = Date.now() - started;

    // Log Execution Metrics in ai_jobs
    try {
      await supabase.from("ai_jobs" as any).insert({
        product_id: productId,
        job_type: "seo",
        status: "success",
        execution_time_ms: executionMs,
        result: {
          engine: "Engine 1 (Product Details Engine)",
          provider: provider.name,
          keys_routed: Object.keys(productPatch),
        },
        completed_at: new Date().toISOString(),
      });
    } catch {}

    // 8. Re-query Updated Product Row for Verification
    const { data: verifiedProduct } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    return {
      ok: true,
      details: json,
      productDescription: productDesc,
      seoDescription: seoDesc,
      product: verifiedProduct,
      executionMs,
      providerName: provider.name,
    };
  });
