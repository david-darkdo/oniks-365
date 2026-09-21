import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { 
  FileText, 
  User as UserIcon, 
  Calendar, 
  Mail, 
  Phone, 
  CheckCircle2, 
  X, 
  ArrowRight,
  Package,
  Clock
} from "lucide-react";
import { groupCollectionsByCustomer, CustomerGroup } from "@/lib/customer-identity";

export const Route = createFileRoute("/_authenticated/admin/collections")({
  head: () => ({ meta: [{ title: "Customer Collection CRM & Quotation Requests — Admin" }] }),
  component: CollectionsCrmPage,
});

const STAGES = ["Draft", "Sent", "Viewed", "Quoted", "Negotiating", "Approved", "Completed", "Cancelled"] as const;
type Stage = (typeof STAGES)[number];

function CollectionsCrmPage() {
  const { isAdmin, loading } = useAuth();
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerGroup | null>(null);

  const load = async () => {
    setBusy(true);
    const [{ data: colls }, { data: items }, { data: profs }, { data: inqs }] = await Promise.all([
      supabase.from("collections").select("*").order("created_at", { ascending: false }),
      supabase.from("collection_items").select("id, collection_id"),
      supabase.from("profiles").select("id, auth_id, full_name, email, created_at"),
      supabase.from("whatsapp_inquiries").select("id, collection_id, customer_name, customer_phone, customer_email, whatsapp_number, inquiry_status, status"),
    ]);

    const itemCount = new Map<string, number>();
    (items ?? []).forEach((i: any) => {
      itemCount.set(i.collection_id, (itemCount.get(i.collection_id) ?? 0) + 1);
    });

    const groups = groupCollectionsByCustomer(colls ?? [], profs ?? [], inqs ?? [], itemCount);
    setCustomerGroups(groups);
    setBusy(false);
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    if (filter === "all") return customerGroups;
    return customerGroups.filter((g) => g.latestStage === filter);
  }, [customerGroups, filter]);

  const byStage = useMemo(() => {
    const m: Record<Stage, CustomerGroup[]> = {
      Draft: [],
      Sent: [],
      Viewed: [],
      Quoted: [],
      Negotiating: [],
      Approved: [],
      Completed: [],
      Cancelled: [],
    };
    customerGroups.forEach((g) => {
      const stage = (STAGES.includes(g.latestStage as any) ? g.latestStage : "Draft") as Stage;
      m[stage].push(g);
    });
    return m;
  }, [customerGroups]);

  // Mandatory Atomic Pipeline Status Mutation with strict error handling
  const handleSetStage = async (card: CustomerGroup, newStage: Stage) => {
    const { data, error } = await (supabase.rpc as any)("update_quotation_pipeline_stage", {
      _collection_id: card.latestCollectionId,
      _new_stage: newStage,
    });

    if (error) {
      toast.error(`Failed to update status: ${error.message}`);
      return;
    }

    toast.success(`Quotation status updated to ${newStage}`);
    void load();
  };

  if (loading || !isAdmin) {
    return <div className="container-app py-8 text-sm text-muted-foreground">Loading Customer CRM Worksheet…</div>;
  }

  const renderCustomerCard = (card: CustomerGroup) => (
    <div
      key={card.key}
      className="rounded-lg border border-border/80 bg-background p-3 text-xs shadow-xs hover:border-primary/40 transition space-y-2"
    >
      {/* Customer Identity Header */}
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <span className="font-bold text-foreground block truncate text-sm">
            {card.customerName}
          </span>
          {card.customerEmail && (
            <span className="text-[11px] text-muted-foreground block truncate">
              {card.customerEmail}
            </span>
          )}
          {card.customerPhone && (
            <span className="text-[10px] text-primary font-mono block truncate">
              {card.customerPhone}
            </span>
          )}
        </div>
        <span className="rounded bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 border border-primary/20 shrink-0">
          {card.totalRequestsCount} req{card.totalRequestsCount === 1 ? "" : "s"}
        </span>
      </div>

      {/* Latest Request Meta */}
      <div className="rounded bg-muted/40 p-2 border border-border/40 space-y-1 text-[11px]">
        <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
          <strong className="text-foreground">{card.latestReference}</strong>
          <span className="text-muted-foreground">{card.latestSubmittedDate}</span>
        </div>
        <p className="text-muted-foreground truncate font-medium">
          {card.latestProjectName}
        </p>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
          <span>{card.latestProductsCount} Product{card.latestProductsCount === 1 ? "" : "s"}</span>
          <span className="uppercase font-bold text-[9px] text-foreground/80">{card.latestStage}</span>
        </div>
      </div>

      {/* Pipeline Stage Selector (Assigned Officer REMOVED) */}
      <div className="pt-1">
        <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">
          Pipeline Stage
        </label>
        <select
          value={card.latestStage}
          onChange={(e) => void handleSetStage(card, e.target.value as Stage)}
          className="w-full rounded border border-border bg-card px-2 py-1 text-[10px] font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Card Actions: Open Workspace + Customer View */}
      <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-1 text-[11px]">
        <Link
          to="/admin/collections/$id"
          params={{ id: card.latestCollectionId }}
          className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
        >
          <FileText className="h-3.5 w-3.5" /> Open Workspace →
        </Link>
        <button
          type="button"
          onClick={() => setSelectedCustomer(card)}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-[10px] font-medium"
        >
          <UserIcon className="h-3 w-3" /> Customer View
        </button>
      </div>
    </div>
  );

  return (
    <div className="container-app py-6 space-y-4">
      {/* Top Header & Stage Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Customer Collection CRM</h1>
          <p className="text-xs text-muted-foreground">
            Manage customer quotation requests, project specifications, and quotation pipeline.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setFilter("all")}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
              filter === "all" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            All Customers ({customerGroups.length})
          </button>
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                filter === s ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {s} ({byStage[s].length})
            </button>
          ))}
        </div>
      </div>

      {/* Pipeline Kanban Grid: All stages vs Filtered Single Stage */}
      {filter === "all" ? (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {STAGES.map((stage) => (
            <div key={stage} className="rounded-xl border border-border bg-card/50 p-2.5">
              <div className="mb-2 flex items-center justify-between border-b border-border/60 pb-1.5 px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{stage}</span>
                <span className="rounded-full bg-surface-2 text-foreground text-[10px] font-bold px-1.5 py-0.5 border border-border">
                  {byStage[stage].length}
                </span>
              </div>

              <div className="space-y-2">
                {byStage[stage].map((card) => renderCustomerCard(card))}

                {byStage[stage].length === 0 && !busy && (
                  <div className="text-[11px] text-muted-foreground/50 text-center py-4">— Empty —</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <span>{filter} Pipeline</span>
              <span className="rounded-full bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 border border-primary/20">
                {filtered.length} Customer{filtered.length === 1 ? "" : "s"}
              </span>
            </h2>
            <button
              onClick={() => setFilter("all")}
              className="text-xs text-primary font-medium hover:underline"
            >
              ← View All Columns ({customerGroups.length})
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/30 p-12 text-center text-muted-foreground text-xs">
              No customer quotation requests currently in the <strong className="text-foreground">{filter}</strong> stage.
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filtered.map((card) => renderCustomerCard(card))}
            </div>
          )}
        </div>
      )}

      {/* PHASE 4: CUSTOMER VIEW MODAL (Admin Customer Information) */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <UserIcon className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-lg font-bold">{selectedCustomer.customerName}</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Customer Profile & Quotation Request History
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Customer Details Grid */}
            <div className="rounded-lg bg-muted/40 p-4 border border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Email Address</span>
                <span className="font-semibold text-foreground break-all">{selectedCustomer.customerEmail || "Not provided"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Phone Number</span>
                <span className="font-semibold text-foreground">{selectedCustomer.customerPhone || "Not provided"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Account Registered</span>
                <span className="text-foreground">
                  {selectedCustomer.accountCreatedAt
                    ? new Date(selectedCustomer.accountCreatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                    : "Guest Identity"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Total Quotation Requests</span>
                <span className="font-bold text-primary">{selectedCustomer.totalRequestsCount} Submitted Requests</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Current Pipeline Status</span>
                <span className="font-bold uppercase text-foreground">{selectedCustomer.latestStage}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Latest Request Reference</span>
                <span className="font-mono font-bold text-foreground">{selectedCustomer.latestReference}</span>
              </div>
            </div>

            {/* Complete Chronological Request History */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" /> Request History ({selectedCustomer.collections.length})
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedCustomer.collections.map((col, idx) => {
                  const dateVal = col.submitted_at || col.created_at;
                  const formattedDate = dateVal
                    ? new Date(dateVal).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                    : "Recent";

                  return (
                    <div
                      key={col.id}
                      className="rounded-lg border border-border/80 p-3 bg-background text-xs flex items-center justify-between gap-3 hover:border-primary/40 transition"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground truncate">{col.project_name || col.name || "Project Request"}</span>
                          {col.version > 1 && (
                            <span className="rounded bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.2 border border-primary/20">
                              v{col.version}
                            </span>
                          )}
                          <span className="rounded bg-muted px-1.5 py-0.2 text-[9px] font-bold uppercase text-muted-foreground border border-border">
                            {col.status || (col.is_locked ? "Submitted" : "Draft")}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {col.reference_number || col.id.slice(0, 8)} • {formattedDate}
                        </p>
                      </div>

                      <Link
                        to="/admin/collections/$id"
                        params={{ id: col.id }}
                        onClick={() => setSelectedCustomer(null)}
                        className="inline-flex items-center gap-1 rounded bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/20 transition shrink-0"
                      >
                        Open Workspace <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <Link
                to="/admin/collections/$id"
                params={{ id: selectedCustomer.latestCollectionId }}
                onClick={() => setSelectedCustomer(null)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-xs"
              >
                <FileText className="h-3.5 w-3.5" /> Open Latest Workspace ({selectedCustomer.latestReference})
              </Link>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-lg border border-border px-4 py-2 text-xs font-medium hover:bg-muted transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
