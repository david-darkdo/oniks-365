import { createFileRoute, Link, useParams, redirect } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  MessageCircle, 
  ExternalLink, 
  Lock, 
  Save, 
  User, 
  Calendar, 
  ShieldAlert, 
  Package, 
  Phone, 
  Mail, 
  Clock
} from "lucide-react";
import { publicImageUrl } from "@/components/ImageUploader";
import { useAppSettings, waLink } from "@/lib/settings";
import { generateCollectionReference } from "@/lib/collection";
import { getCustomerIdentityKey, normalizePhone, normalizeEmail } from "@/lib/customer-identity";

const STAGES = ["Draft", "Sent", "Viewed", "Quoted", "Negotiating", "Approved", "Completed", "Cancelled"] as const;
type Stage = (typeof STAGES)[number];

export const Route = createFileRoute("/_authenticated/admin/collections_/$id")({
  head: () => ({ meta: [{ title: "Customer Quotation Workspace — Admin" }] }),
  beforeLoad: async ({ location, params }) => {
    // 1. Verify authentication
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      throw redirect({
        to: "/auth",
        search: { redirectTo: location.pathname },
      });
    }

    // 2. Real server-side authorization check (handles multiple role rows without .maybeSingle failure)
    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id);

    const isAuthorized = (roleRows || []).some(
      (r) => r.role === "admin" || r.role === "super_admin"
    );

    if (roleError || !isAuthorized) {
      throw redirect({
        to: "/admin",
      });
    }

    return { user: authData.user };
  },
  component: AdminCustomerWorkspacePage,
});

function AdminCustomerWorkspacePage() {
  const { id } = Route.useParams();
  const { isAdmin, loading: authLoading } = useAuth();
  const { data: settings } = useAppSettings();

  const [collection, setCollection] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [inquiry, setInquiry] = useState<any>(null);
  const [customerHistory, setCustomerHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Stage>("Draft");

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch current collection record
      const { data: coll, error: collErr } = await supabase
        .from("collections")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (collErr || !coll) {
        toast.error("Collection record not found");
        setLoading(false);
        return;
      }
      setCollection(coll);
      setNotes(coll.internal_notes || "");

      const currentStage = (coll.status && STAGES.includes(coll.status as any) ? coll.status : "Draft") as Stage;
      setStatus(currentStage);

      // 2. Fetch collection items with full product details
      const { data: rawItems, error: itemsErr } = await supabase
        .from("collection_items")
        .select(`
          *,
          products (
            id,
            name,
            code,
            price,
            pricing_unit,
            brand,
            image_url,
            generated_studio_image,
            slug
          )
        `)
        .eq("collection_id", id);

      if (itemsErr) {
        toast.error("Error loading collection items");
      }
      setItems(rawItems || []);

      // 3. Fetch customer profile if user_id present
      let loadedProfile: any = null;
      if (coll.user_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("auth_id", coll.user_id)
          .maybeSingle();
        if (prof) {
          loadedProfile = prof;
          setProfile(prof);
        }
      }

      // 4. Fetch linked whatsapp inquiry
      const { data: inq } = await supabase
        .from("whatsapp_inquiries")
        .select("*")
        .eq("collection_id", id)
        .maybeSingle();
      if (inq) {
        setInquiry(inq);
      }

      // 5. PHASE 5: Fetch complete request history for this customer (Consistent Identity Resolver)
      if (coll.user_id) {
        const { data: hist } = await supabase
          .from("collections")
          .select("id, name, project_name, reference_number, version, status, is_locked, created_at, submitted_at, parent_collection_id")
          .eq("user_id", coll.user_id)
          .order("created_at", { ascending: false });
        setCustomerHistory(hist || []);
      } else {
        // Guest customer identity resolution
        const phone = normalizePhone(inq?.customer_phone || inq?.whatsapp_number);
        const email = normalizeEmail(inq?.customer_email);

        if (phone || email) {
          // Fetch inquiries matching this phone/email
          const filter = phone ? `customer_phone.eq.${phone}` : `customer_email.eq.${email}`;
          const { data: matchingInqs } = await supabase
            .from("whatsapp_inquiries")
            .select("collection_id")
            .or(filter);

          const matchingColIds = Array.from(new Set((matchingInqs || []).map((i: any) => i.collection_id).filter(Boolean)));
          if (matchingColIds.length > 0) {
            const { data: hist } = await supabase
              .from("collections")
              .select("id, name, project_name, reference_number, version, status, is_locked, created_at, submitted_at, parent_collection_id")
              .in("id", matchingColIds)
              .order("created_at", { ascending: false });
            setCustomerHistory(hist || [coll]);
          } else {
            setCustomerHistory([coll]);
          }
        } else {
          setCustomerHistory([coll]);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load quotation data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [id]);

  // Mandatory Atomic Pipeline Status Mutation with strict error inspection
  const handleSaveStatus = async (newStage: Stage) => {
    const { data, error } = await (supabase.rpc as any)("update_quotation_pipeline_stage", {
      _collection_id: id,
      _new_stage: newStage,
    });

    if (error) {
      toast.error(`Failed to update status: ${error.message}`);
      return;
    }

    setStatus(newStage);
    toast.success(`Quotation status updated to ${newStage}`);
    void loadData();
  };

  // Internal Notes save with explicit error inspection
  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from("collections")
        .update({ internal_notes: notes.trim() || null })
        .eq("id", id);

      if (error) {
        toast.error(`Failed to save notes: ${error.message}`);
        return;
      }
      toast.success("Internal admin notes saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  // Total Quotation Value
  const totalEstimate = useMemo(() => {
    return items.reduce((acc, item) => {
      const price = Number(item.products?.price) || 0;
      const qty = Number(item.quantity) || 1;
      return acc + (price * qty);
    }, 0);
  }, [items]);

  if (authLoading || loading) {
    return (
      <div className="container-app py-12 text-sm font-mono text-muted-foreground">
        Loading quotation workspace & verifying admin permissions…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container-app py-12 max-w-xl text-center">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 space-y-4">
          <ShieldAlert className="h-10 w-10 text-destructive mx-auto" />
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-destructive">
            Access Denied
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            You do not have administrative permissions to inspect this customer quotation request.
          </p>
          <Link
            to="/admin/collections"
            className="inline-block rounded-lg bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition"
          >
            Return to Command Center
          </Link>
        </div>
      </div>
    );
  }

  const customerName = profile?.full_name || inquiry?.customer_name || collection?.customer_name || "Valued Customer";
  const customerEmail = profile?.email || inquiry?.customer_email || collection?.customer_email || "Not provided";
  const customerPhone = inquiry?.customer_phone || inquiry?.whatsapp_number || profile?.phone_number || collection?.customer_phone || "";
  const targetWaNumber = customerPhone || settings?.sales_whatsapp || "";

  // Single smart link referenced in WhatsApp quotation response
  const smartCollectionUrl = `https://oniks365.ng/collection/${id}`;
  const refNum = collection?.reference_number || generateCollectionReference(id);

  const quotationSummaryText = [
    `*ONIKS 365 — Quotation Resolution*`,
    `Ref: ${refNum}`,
    `Customer: ${customerName}`,
    `Project: ${collection?.project_name || collection?.name || "Showroom Selection"}`,
    ``,
    `*Selected Items Breakdown:*`,
    ...items.map((i, idx) => {
      const p = i.products;
      const unit = i.unit || p?.pricing_unit || "piece";
      const price = Number(p?.price) || 0;
      const total = price * (Number(i.quantity) || 1);
      return `${idx + 1}. ${p?.name || "Product"} (Code: ${p?.code || "N/A"}) — Qty: ${i.quantity} ${unit} @ ₦${price.toLocaleString()} = ₦${total.toLocaleString()}${i.installation_location ? ` [${i.installation_location}]` : ""}`;
    }),
    ``,
    `*Total Estimated Value: ₦${totalEstimate.toLocaleString()}*`,
    `Project Review Link: ${smartCollectionUrl}`,
    ``,
    `Our procurement engineers have reviewed your project specifications and are prepared to process fulfillment.`
  ].join("\n");

  return (
    <div className="container-app py-6 max-w-6xl space-y-6">
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <Link
            to="/admin/collections"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground mb-1.5 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Customer CRM Pipeline
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">
              {customerName}
            </h1>
            <span className="rounded-md bg-muted px-2.5 py-0.5 font-mono text-xs font-bold text-foreground border border-border">
              {refNum}
            </span>
            {collection?.version && collection.version > 1 && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary border border-primary/20">
                v{collection.version}
              </span>
            )}
            {collection?.is_locked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-500 border border-amber-500/20">
                <Lock className="h-3 w-3" /> Submitted & Locked Snapshot
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Submitted on {collection?.submitted_at ? new Date(collection.submitted_at).toLocaleString() : new Date(collection?.created_at).toLocaleString()}
          </p>
        </div>

        {/* Right CTA Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {targetWaNumber && (
            <a
              href={waLink(targetWaNumber, quotationSummaryText)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-500 transition shadow-sm"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Send Quote via WhatsApp
            </a>
          )}
        </div>
      </div>

      {/* Grid: Information Summary (Left) & Pipeline Resolution Controls (Right) */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left 2 Cols: Customer Identity & Selected Products Detailed Table */}
        <div className="md:col-span-2 space-y-6">
          {/* Customer & Project Identity Card */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-3">
            <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b border-border/60 pb-2">
              <User className="h-3.5 w-3.5 text-primary" /> Customer Identity & Contact Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Customer Name</span>
                <span className="font-semibold text-foreground">{customerName}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Email Address</span>
                <span className="font-semibold text-foreground break-all">{customerEmail}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Phone Number</span>
                <span className="font-semibold text-foreground">{customerPhone || "Not provided"}</span>
              </div>
              {collection?.project_name && (
                <div className="sm:col-span-3 pt-2 border-t border-border/40">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Project Specification Name</span>
                  <span className="font-semibold text-primary">{collection.project_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Customer-Selected Products Detailed Table */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <Package className="h-3.5 w-3.5 text-primary" /> Customer-Selected Products ({items.length})
              </h3>
              <span className="font-display text-xs font-bold text-primary">
                Total Estimate: ₦{totalEstimate.toLocaleString()}
              </span>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center italic">
                No products recorded in this quotation collection.
              </p>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const p = item.products;
                  const img = p ? (publicImageUrl(p.generated_studio_image) || publicImageUrl(p.image_url)) : "";
                  const unit = item.unit || p?.pricing_unit || "piece";
                  const price = Number(p?.price) || 0;
                  const itemTotal = price * (Number(item.quantity) || 1);

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border/70 bg-background p-3.5 text-xs shadow-xs space-y-2.5 transition hover:border-primary/40"
                    >
                      <div className="flex items-start gap-3">
                        {/* Mandatory Product Image */}
                        <div className="h-16 w-16 rounded-lg overflow-hidden border border-border bg-muted shrink-0 flex items-center justify-center">
                          {img ? (
                            <img src={img} alt={p?.name || "Product"} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-muted-foreground">No image</span>
                          )}
                        </div>

                        {/* Product Core Details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-semibold text-sm text-foreground line-clamp-1">
                                {p?.name || "Custom Product Item"}
                              </h4>
                              <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                                {p?.brand ? `${p.brand} · ` : ""}Code: {p?.code || "N/A"}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="font-display text-sm font-bold text-foreground block">
                                ₦{itemTotal.toLocaleString()}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                ₦{price.toLocaleString()} / {unit}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="rounded bg-primary/10 px-2 py-0.5 font-semibold text-primary text-[10px]">
                              Quantity: {item.quantity || 1} {unit}
                            </span>
                            {p?.slug && (
                              <Link
                                to="/product/$slug"
                                params={{ slug: p.slug }}
                                target="_blank"
                                className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline ml-auto"
                              >
                                View Live Product <ExternalLink className="h-2.5 w-2.5" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Project Specifications & Preferences */}
                      {(item.installation_location || item.delivery_preference || item.installation_required || item.project_notes) && (
                        <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] grid grid-cols-1 sm:grid-cols-3 gap-2 border border-border/40 text-muted-foreground">
                          {item.installation_location && (
                            <div>
                              <strong className="text-foreground">Location:</strong> {item.installation_location}
                            </div>
                          )}
                          {item.delivery_preference && (
                            <div>
                              <strong className="text-foreground">Delivery:</strong> {item.delivery_preference}
                            </div>
                          )}
                          {item.installation_required && (
                            <div>
                              <strong className="text-foreground">Installation:</strong> {item.installation_required}
                            </div>
                          )}
                          {item.project_notes && (
                            <div className="sm:col-span-3 text-foreground pt-1 border-t border-border/30">
                              <strong>Client Notes:</strong> {item.project_notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Quotation Pipeline Resolution & Customer Request History */}
        <div className="space-y-6">
          {/* Status Controls Box (Assigned Officer REMOVED) */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
            <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60 pb-2">
              Quotation Pipeline Controls
            </h3>

            {/* Stage Selector */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                Quotation Stage
              </label>
              <select
                value={status}
                onChange={(e) => void handleSaveStatus(e.target.value as Stage)}
                className="w-full rounded-lg border border-border bg-background p-2 text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Total Quotation Summary */}
            <div className="rounded-lg bg-muted/40 p-3 border border-border/50 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Total Estimated Value
              </span>
              <div className="font-display text-lg font-bold text-primary">
                ₦{totalEstimate.toLocaleString()}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Derived from {items.length} line item{items.length === 1 ? "" : "s"} at catalog prices.
              </p>
            </div>
          </div>

          {/* Internal Admin CRM Notes */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Internal Admin CRM Notes
              </h3>
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/20 transition disabled:opacity-50"
              >
                <Save className="h-3 w-3" /> {savingNotes ? "Saving…" : "Save Notes"}
              </button>
            </div>
            <textarea
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal pricing notes, client negotiations, delivery logistics details..."
              className="w-full rounded-lg border border-border bg-background p-3 text-xs leading-relaxed focus:ring-2 focus:ring-primary focus:outline-none"
            />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              These notes are private to administrators and will never be shown to customers.
            </p>
          </div>

          {/* PHASE 5: Customer Request History (Consolidated & Consistent) */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" /> Customer Request History ({customerHistory.length})
              </h3>
            </div>
            {customerHistory.length > 0 ? (
              <div className="space-y-2.5 max-h-72 overflow-y-auto">
                {customerHistory.map((hist) => {
                  const isCurrent = hist.id === id;
                  const histDate = hist.submitted_at || hist.created_at;
                  const formattedHistDate = histDate 
                    ? new Date(histDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                    : "Recent";
                  const histRef = hist.reference_number || generateCollectionReference(hist.id);

                  return (
                    <div 
                      key={hist.id} 
                      className={`rounded-lg border p-2.5 text-xs transition ${
                        isCurrent 
                          ? "border-primary/50 bg-primary/5 shadow-xs" 
                          : "border-border/70 bg-background hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-semibold text-foreground truncate max-w-[150px]">
                          {hist.project_name || hist.name || "Project Request"}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {hist.version > 1 && (
                            <span className="rounded bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.2 border border-primary/20">
                              v{hist.version}
                            </span>
                          )}
                          <span className="rounded bg-muted px-1.5 py-0.2 text-[9px] font-bold uppercase text-muted-foreground border border-border">
                            {hist.status || (hist.is_locked ? "Submitted" : "Draft")}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{histRef} • {formattedHistDate}</span>
                        {isCurrent ? (
                          <span className="font-bold text-primary text-[10px]">● Active Snapshot</span>
                        ) : (
                          <Link 
                            to="/admin/collections/$id" 
                            params={{ id: hist.id }} 
                            className="font-semibold text-primary hover:underline"
                          >
                            Open Snapshot →
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic py-2">No other historical requests found for this customer.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
