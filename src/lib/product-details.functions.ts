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

function cleanStringArray(val: any): string[] {
  if (Array.isArray(val)) {
    return Array.from(
      new Set(
        val
          .map((s) => String(s || "").trim())
          .filter((s) => s.length > 1 && !isPlaceholder(s))
      )
    );
  }
  if (typeof val === "string" && val.trim()) {
    return Array.from(
      new Set(
        val
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 1 && !isPlaceholder(s))
      )
    );
  }
  return [];
}

function isPlaceholder(s: string): boolean {
  const lower = s.toLowerCase().trim();
  return (
    lower === "n/a" ||
    lower === "none" ||
    lower === "null" ||
    lower === "undefined" ||
    lower === "placeholder" ||
    lower === "tbd" ||
    lower.startsWith("example") ||
    lower.startsWith("placeholder")
  );
}

interface IntelligenceValidation {
  isComplete: boolean;
  missing: string[];
  cleanData: {
    product_description?: string;
    product_highlights?: string[];
    product_features?: string[];
    product_benefits?: string[];
    seo_title?: string;
    seo_description?: string;
    seo_keywords?: string[];
    search_keywords?: string[];
    alternative_names?: string[];
    customer_search_phrases?: string[];
    search_synonyms?: string[];
    related_search_terms?: string[];
    common_misspellings?: string[];
    showroom_search_index?: string[];
    faq?: Array<{ question: string; answer: string }>;
  };
}

function checkSemanticCompleteness(data: any): IntelligenceValidation {
  const missing: string[] = [];
  const cleanData: IntelligenceValidation["cleanData"] = {};

  // 1. Description
  const desc = String(data?.product_description || data?.generated_description || data?.description || "").trim();
  if (desc.length > 25 && !isPlaceholder(desc)) {
    cleanData.product_description = desc;
  } else {
    missing.push("product_description");
  }

  // 2. Highlights, Features, Benefits
  const highlights = cleanStringArray(data?.product_highlights);
  if (highlights.length >= 2) cleanData.product_highlights = highlights; else missing.push("product_highlights");

  const features = cleanStringArray(data?.product_features);
  if (features.length >= 2) cleanData.product_features = features; else missing.push("product_features");

  const benefits = cleanStringArray(data?.product_benefits);
  if (benefits.length >= 2) cleanData.product_benefits = benefits; else missing.push("product_benefits");

  // 3. SEO Title, Description, Keywords
  const seoTitle = String(data?.seo_title || data?.open_graph_title || "").trim();
  if (seoTitle.length > 5 && !isPlaceholder(seoTitle)) cleanData.seo_title = seoTitle; else missing.push("seo_title");

  const seoDesc = String(data?.seo_description || data?.meta_description || "").trim();
  if (seoDesc.length > 15 && !isPlaceholder(seoDesc)) cleanData.seo_description = seoDesc; else missing.push("seo_description");

  const seoKeywords = cleanStringArray(data?.seo_keywords);
  if (seoKeywords.length >= 2) cleanData.seo_keywords = seoKeywords; else missing.push("seo_keywords");

  // 4. Search Intelligence Arrays
  const searchKeywords = cleanStringArray(data?.search_keywords);
  if (searchKeywords.length >= 2) cleanData.search_keywords = searchKeywords; else missing.push("search_keywords");

  const altNames = cleanStringArray(data?.alternative_names || data?.alternative_terms || data?.search_aliases);
  if (altNames.length >= 2) cleanData.alternative_names = altNames; else missing.push("alternative_names");

  const customerPhrases = cleanStringArray(data?.customer_search_phrases);
  if (customerPhrases.length >= 2) cleanData.customer_search_phrases = customerPhrases; else missing.push("customer_search_phrases");

  const synonyms = cleanStringArray(data?.search_synonyms);
  if (synonyms.length >= 2) cleanData.search_synonyms = synonyms; else missing.push("search_synonyms");

  const related = cleanStringArray(data?.related_search_terms);
  if (related.length >= 2) cleanData.related_search_terms = related; else missing.push("related_search_terms");

  const misspellings = cleanStringArray(data?.common_misspellings);
  if (misspellings.length >= 1) cleanData.common_misspellings = misspellings; else missing.push("common_misspellings");

  const showroomIndex = cleanStringArray(data?.showroom_search_index);
  if (showroomIndex.length >= 2) cleanData.showroom_search_index = showroomIndex; else missing.push("showroom_search_index");

  // 5. Canonical FAQs
  let faqs: Array<{ question: string; answer: string }> = [];
  if (Array.isArray(data?.faq)) {
    faqs = data.faq
      .map((item: any) => {
        if (!item || typeof item !== "object") return null;
        const q = String(item.question || item.q || "").trim();
        const a = String(item.answer || item.a || "").trim();
        if (q.length > 5 && a.length > 5 && !isPlaceholder(q) && !isPlaceholder(a)) {
          return { question: q, answer: a };
        }
        return null;
      })
      .filter(Boolean) as Array<{ question: string; answer: string }>;
  }
  if (faqs.length >= 2) cleanData.faq = faqs.slice(0, 3); else missing.push("faq");

  return {
    isComplete: missing.length === 0,
    missing,
    cleanData
  };
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

    // 3. Load Active AI Prompt Template (Rule D3: No silent fallback - explicit DB template required)
    const { data: activeTemplate, error: templateErr } = await supabase
      .from("ai_prompt_templates")
      .select("prompt_text")
      .eq("key", "product_details")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (templateErr || !activeTemplate?.prompt_text) {
      throw new Error(
        "Active AI prompt template for 'product_details' not found in database. Please ensure the 'product_details' template is configured and active under Admin > AI Templates before running product generation."
      );
    }

    const templateText = activeTemplate.prompt_text;

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
      .replace(/{family}/g, familyName)
      .replace(/{differentiator_type}/g, product.differentiator_type || "None specified")
      .replace(/{differentiator_note}/g, product.differentiator_note || "None specified");

    if (familyOverride) {
      prompt += `\n\nAdditional Family Directives: ${familyOverride}`;
    }

    // 5. Call LLM Provider (Pass 1)
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

    const { data: firstPassJson, error: parseError } = await tryJSON<any>(
      provider,
      prompt,
      systemPrompt,
      imageUrl
    );

    if (!firstPassJson) {
      throw new Error(`Engine 1 [${provider.name}]: ${parseError || "Failed to generate valid JSON intelligence payload"}`);
    }

    let combinedData: Record<string, any> = { ...firstPassJson };
    let validation = checkSemanticCompleteness(combinedData);

    // Controlled Repair Attempt (Pass 2) if semantic validation detected missing/empty fields
    if (!validation.isComplete) {
      console.warn(`[Engine 1] Semantic validation incomplete. Missing fields: ${validation.missing.join(", ")}. Executing controlled repair...`);
      try {
        const repairPrompt = `You previously generated product intelligence for this product, but the following required fields were missing, empty, or incomplete:
Missing Fields: ${validation.missing.join(", ")}

PRODUCT CONTEXT:
Product Name: ${product.name}
Code: ${product.code}
Brand: ${product.brand ?? "ONIKS365 Showroom"}
Material: ${product.material ?? "premium material"}
Finish: ${product.finish ?? product.finish_name ?? "premium finish"}
Category: ${categoryName}
Type: ${typeName}
Subcategory: ${subcategoryName}
Differentiator Type: ${product.differentiator_type || "None specified"}
Differentiator Note: ${product.differentiator_note || "None specified"}

INSTRUCTIONS:
Generate and return ONLY the missing fields in a valid JSON object matching the canonical keys:
${JSON.stringify(
  Object.fromEntries(
    validation.missing.map((k) => [
      k,
      k === "faq"
        ? [{ question: "Specific question about plumbing/finish/installation", answer: "Factual concise answer" }]
        : k.endsWith("_description") || k.endsWith("_title")
        ? "string"
        : ["item 1", "item 2"]
    ])
  ),
  null,
  2
)}

STRICT RULES:
- Address this specific luxury product and its differentiator directly.
- Return ONLY valid compact JSON containing the missing keys with non-empty, meaningful content.
- Never return empty arrays or placeholder strings.`;

        const repairRes = await tryJSON<any>(provider, repairPrompt, systemPrompt);
        if (repairRes.data) {
          combinedData = { ...combinedData, ...repairRes.data };
          validation = checkSemanticCompleteness(combinedData);
        }
      } catch (repairErr: any) {
        console.warn("[Engine 1] Controlled repair attempt encountered an error:", repairErr?.message);
      }
    }

    // 6. PRESERVATION OF VALID EXISTING INTELLIGENCE (A6)
    // Never overwrite valid existing intelligence with an empty array or empty string!
    const existingDoc = (product.master_document && typeof product.master_document === "object")
      ? (product.master_document as Record<string, any>)
      : {};

    const finalDescription = validation.cleanData.product_description || product.generated_description || product.short_description || "";
    const finalHighlights = (validation.cleanData.product_highlights && validation.cleanData.product_highlights.length > 0)
      ? validation.cleanData.product_highlights
      : cleanStringArray(existingDoc.product_highlights);

    const finalFeatures = (validation.cleanData.product_features && validation.cleanData.product_features.length > 0)
      ? validation.cleanData.product_features
      : cleanStringArray(existingDoc.product_features);

    const finalBenefits = (validation.cleanData.product_benefits && validation.cleanData.product_benefits.length > 0)
      ? validation.cleanData.product_benefits
      : cleanStringArray(existingDoc.product_benefits);

    const finalSeoTitle = validation.cleanData.seo_title || product.seo_title || (product.name ? `${product.name} | ONIKS365 Nigeria` : "");
    const finalSeoDescription = validation.cleanData.seo_description || product.seo_description || "";
    const finalSeoKeywords = (validation.cleanData.seo_keywords && validation.cleanData.seo_keywords.length > 0)
      ? validation.cleanData.seo_keywords
      : cleanStringArray(product.seo_keywords);

    const finalSearchKeywords = (validation.cleanData.search_keywords && validation.cleanData.search_keywords.length > 0)
      ? validation.cleanData.search_keywords
      : cleanStringArray(existingDoc.search_keywords || product.app_keywords);

    const finalAltNames = (validation.cleanData.alternative_names && validation.cleanData.alternative_names.length > 0)
      ? validation.cleanData.alternative_names
      : cleanStringArray(existingDoc.alternative_names);

    const finalCustomerPhrases = (validation.cleanData.customer_search_phrases && validation.cleanData.customer_search_phrases.length > 0)
      ? validation.cleanData.customer_search_phrases
      : cleanStringArray(existingDoc.customer_search_phrases);

    const finalSynonyms = (validation.cleanData.search_synonyms && validation.cleanData.search_synonyms.length > 0)
      ? validation.cleanData.search_synonyms
      : cleanStringArray(existingDoc.search_synonyms);

    const finalRelated = (validation.cleanData.related_search_terms && validation.cleanData.related_search_terms.length > 0)
      ? validation.cleanData.related_search_terms
      : cleanStringArray(existingDoc.related_search_terms);

    const finalMisspellings = (validation.cleanData.common_misspellings && validation.cleanData.common_misspellings.length > 0)
      ? validation.cleanData.common_misspellings
      : cleanStringArray(existingDoc.common_misspellings);

    const finalShowroomIndex = (validation.cleanData.showroom_search_index && validation.cleanData.showroom_search_index.length > 0)
      ? validation.cleanData.showroom_search_index
      : cleanStringArray(existingDoc.showroom_search_index);

    const finalFaqs = (validation.cleanData.faq && validation.cleanData.faq.length >= 2)
      ? validation.cleanData.faq
      : (Array.isArray(product.faq) && product.faq.length >= 2)
      ? product.faq
      : (Array.isArray(existingDoc.faq) && existingDoc.faq.length >= 2)
      ? existingDoc.faq
      : [];

    const googleSearchTags = cleanStringArray(combinedData.google_search_tags || existingDoc.google_search_tags);
    const googleLocalSearchTerms = cleanStringArray(combinedData.google_local_search_terms || existingDoc.google_local_search_terms);
    const locationKeywords = cleanStringArray(combinedData.location_keywords || existingDoc.location_keywords);

    // Canonical Slug Guarantee: Preserve existing slug to avoid breaking external links if already set
    const rawSlugCandidate = combinedData.slug || combinedData.canonical_slug;
    const generatedSlug = slugify(rawSlugCandidate) || slugify(product.name) || `product-${product.code || productId.slice(0, 8)}`;
    const canonicalSlug = (product.slug && product.slug.trim()) ? product.slug : generatedSlug;

    // Check final completeness after repair & preservation
    const unresolvedFields: string[] = [];
    if (!finalDescription || finalDescription.length < 25) unresolvedFields.push("product_description");
    if (finalHighlights.length < 2) unresolvedFields.push("product_highlights");
    if (finalFeatures.length < 2) unresolvedFields.push("product_features");
    if (finalBenefits.length < 2) unresolvedFields.push("product_benefits");
    if (!finalSeoTitle || finalSeoTitle.length < 5) unresolvedFields.push("seo_title");
    if (!finalSeoDescription || finalSeoDescription.length < 15) unresolvedFields.push("seo_description");
    if (finalSearchKeywords.length < 2) unresolvedFields.push("search_keywords");
    if (finalAltNames.length < 2) unresolvedFields.push("alternative_names");
    if (finalCustomerPhrases.length < 2) unresolvedFields.push("customer_search_phrases");
    if (finalSynonyms.length < 2) unresolvedFields.push("search_synonyms");
    if (finalRelated.length < 2) unresolvedFields.push("related_search_terms");
    if (finalMisspellings.length < 1) unresolvedFields.push("common_misspellings");
    if (finalShowroomIndex.length < 2) unresolvedFields.push("showroom_search_index");
    if (finalFaqs.length < 2) unresolvedFields.push("faq");

    const isFullyComplete = unresolvedFields.length === 0;

    // 7. BUILD EXPLICIT DATABASE PATCH
    const productPatch: Record<string, any> = {};

    if (finalDescription) {
      productPatch.generated_description = finalDescription;
      if (!product.short_description || product.short_description.trim() === "") {
        const shortDescCandidate = combinedData.short_description || (finalDescription.length > 180 ? `${finalDescription.slice(0, 177).trim()}…` : finalDescription);
        productPatch.short_description = shortDescCandidate;
      }
    }

    if (finalSeoDescription && !product.seo_description_manual) {
      productPatch.seo_description = finalSeoDescription.length > 165 ? `${finalSeoDescription.slice(0, 162).trim()}…` : finalSeoDescription;
    }

    if (finalSeoTitle && !product.seo_title_manual) {
      productPatch.seo_title = finalSeoTitle;
    }

    productPatch.canonical_slug = canonicalSlug;
    if (!product.slug || product.slug.trim() === "") {
      productPatch.slug = canonicalSlug;
    }

    if (!product.seo_keywords_manual && finalSeoKeywords.length > 0) {
      productPatch.seo_keywords = Array.from(new Set([...finalSeoKeywords, ...googleSearchTags]));
    }

    if (finalFaqs.length > 0) {
      productPatch.faq = finalFaqs;
    }

    // Build Master Document Object
    const masterDocument: Record<string, any> = {
      alternative_names: finalAltNames,
      customer_search_phrases: finalCustomerPhrases,
      search_synonyms: finalSynonyms,
      related_search_terms: finalRelated,
      common_misspellings: finalMisspellings,
      product_highlights: finalHighlights,
      product_features: finalFeatures,
      product_benefits: finalBenefits,
      google_search_tags: googleSearchTags,
      google_local_search_terms: googleLocalSearchTerms,
      location_keywords: locationKeywords,
      showroom_search_index: finalShowroomIndex,
      search_keywords: finalSearchKeywords,
      seo_keywords: finalSeoKeywords,
      faq: finalFaqs,
      open_graph_title: combinedData.open_graph_title || finalSeoTitle,
      open_graph_description: combinedData.open_graph_description || finalSeoDescription,
      canonical_slug: canonicalSlug,
      style: combinedData.style || existingDoc.style || "",
      installation_type: combinedData.installation_type || existingDoc.installation_type || "",
      installation_context: combinedData.installation_context || contextName,
    };

    productPatch.master_document = masterDocument;
    productPatch.ai_understanding = masterDocument;
    if (combinedData.structured_data) {
      productPatch.structured_data = combinedData.structured_data;
    }

    // Combined Search Keywords for Discovery Engine
    const rawSearchKeywords = [
      ...googleSearchTags,
      ...googleLocalSearchTerms,
      ...finalSearchKeywords,
      ...finalSynonyms,
      ...finalAltNames,
      ...finalRelated,
      ...finalCustomerPhrases,
      ...finalMisspellings,
      ...locationKeywords,
      ...finalShowroomIndex,
      ...finalHighlights,
      ...finalFeatures,
      ...finalBenefits,
    ].filter(Boolean);

    if (rawSearchKeywords.length > 0) {
      const searchArray = Array.from(new Set(rawSearchKeywords));
      productPatch.app_keywords = searchArray;
      productPatch.app_search_keywords = searchArray;
    }

    productPatch.last_processed_at = new Date().toISOString();

    if (isFullyComplete) {
      productPatch.processing_state = "completed";
      productPatch.error_log = null;
      productPatch.is_published = true;
    } else {
      productPatch.processing_state = "error";
      productPatch.error_log = {
        message: "Semantic completeness validation failed after repair attempt",
        missing_fields: unresolvedFields,
      };
    }

    // 8. Save Product Updates to Supabase
    const { error: updateErr } = await supabase.from("products").update(productPatch as any).eq("id", productId);
    if (updateErr) {
      throw new Error(`Failed to update product record: ${updateErr.message}`);
    }

    // Save Product Intelligence Backup
    await supabase.from("product_understanding" as any).upsert({
      product_id: productId,
      raw_ai_response: combinedData,
      detected_material: combinedData.material ?? product.material ?? null,
      detected_finish: combinedData.finish ?? product.finish ?? null,
      detected_color: combinedData.color ?? product.color ?? null,
      detected_keywords: productPatch.app_keywords ?? [],
      confidence_score: isFullyComplete ? 0.95 : 0.6,
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

    const executionMs = Date.now() - started;

    // Log Execution in ai_jobs
    try {
      await supabase.from("ai_jobs" as any).insert({
        product_id: productId,
        job_type: "seo",
        status: isFullyComplete ? "success" : "failed",
        execution_time_ms: executionMs,
        result: {
          engine: "Engine 1 (Product Details Engine)",
          provider: provider.name,
          keys_routed: Object.keys(productPatch),
          is_complete: isFullyComplete,
          missing_fields: unresolvedFields,
        },
        completed_at: new Date().toISOString(),
      });
    } catch {}

    // A7: Rebuild Search Index ONLY on successful complete intelligence
    if (isFullyComplete) {
      await supabase.rpc("rebuild_search_index" as any, { _product_id: productId } as any);
    } else {
      console.warn(`[Engine 1] Skipping search index rebuild for product ${productId} due to incomplete fields: ${unresolvedFields.join(", ")}`);
    }

    // 9. Re-query Updated Product Row for Verification
    const { data: verifiedProduct } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (!isFullyComplete) {
      throw new Error(`Product Intelligence validation failed: Missing required fields [${unresolvedFields.join(", ")}]. Preserved existing valid data; marked state as error.`);
    }

    return {
      ok: true,
      details: masterDocument,
      productDescription: finalDescription,
      seoDescription: finalSeoDescription,
      product: verifiedProduct,
      executionMs,
      providerName: provider.name,
    };
  });
