import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ExternalLink, MessageCircle, User as UserIcon, Copy, Lock, RefreshCw, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/collections")({
  head: () => ({ meta: [{ title: "Collection CRM & Quotation Requests — Admin" }] }),
  component: CollectionsCrmPage,
});

const STAGES = ["Draft", "Sent", "Viewed", "Quoted", "Negotiating", "Approved", "Completed", "Cancelled"] as const;
type Stage = (typeof STAGES)[number];

type Row = {
  id: string;
  user_id: string;
  name: string;
  reference_number: string | null;
  project_name: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_profile_id: string | null;
  products_count: number;
  created_at: string;
  submitted_at: string | null;
  display_date: string;
  whatsapp_sent: boolean;
  is_locked: boolean;
  version: number;
  parent_collection_id: string | null;
  status: Stage;
  assigned_admin_id: string | null;
  internal_notes: string | null;
  inquiry_id: string | null;
  history_count: number;
};

function CollectionsCrmPage() {
  const { isAdmin, loading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [admins, setAdmins] = useState<Array<{ id: string; full_name: string | null; email: string | null; auth_id: string }>>([]);
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);

  const load = async () => {
    setBusy(true);
    const [{ data: colls }, { data: items }, { data: profs }, { data: inqs }, { data: roleRows }] = await Promise.all([
      supabase.from("collections").select("*").order("created_at", { ascending: false }),
      supabase.from("collection_items").select("*"),
      supabase.from("profiles").select("id,auth_id,full_name,email,phone_number"),
      supabase.from("whatsapp_inquiries").select("id,collection_id,assigned_admin_id,inquiry_status,customer_name,customer_phone"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    const profByAuth = new Map((profs ?? []).map((p: any) => [p.auth_id, p]));
    const itemCount = new Map<string, number>();
    (items ?? []).forEach((i: any) => itemCount.set(i.collection_id, (itemCount.get(i.collection_id) ?? 0) + 1));
    const inqByColl = new Map<string, any>();
    (inqs ?? []).forEach((i: any) => inqByColl.set(i.collection_id, i));

    const adminIds = new Set((roleRows ?? []).filter((r: any) => r.role === "admin" || r.role === "super_admin").map((r: any) => r.user_id));
    const adminList = (profs ?? []).filter((p: any) => adminIds.has(p.auth_id));
    setAdmins(adminList as any);

    // Group collections by Customer so each customer is ONE workspace in the pipeline
    const groupsByCustomer = new Map<string, any[]>();
    (colls ?? []).forEach((c: any) => {
      const key = c.user_id || c.id;
      if (!groupsByCustomer.has(key)) groupsByCustomer.set(key, []);
      groupsByCustomer.get(key)!.push(c);
    });

    const out: Row[] = Array.from(groupsByCustomer.values()).map((customerColls) => {
      // Sort to prioritize latest submitted request, then newest created
      customerColls.sort((a, b) => {
        const timeA = new Date(a.submitted_at || a.created_at).getTime();
        const timeB = new Date(b.submitted_at || b.created_at).getTime();
        return timeB - timeA;
      });

      const active = customerColls[0];
      const p = profByAuth.get(active.user_id) as any;
      const inq = inqByColl.get(active.id);
      
      let rawStatus: Stage = "Draft";
      if (active.status && STAGES.includes(active.status as any)) {
        rawStatus = active.status as Stage;
      } else if (active.whatsapp_sent || active.inquiry_status === "SENT") {
        rawStatus = "Sent";
      } else if (active.inquiry_status && STAGES.includes(active.inquiry_status as any)) {
        rawStatus = active.inquiry_status as Stage;
      }

      const dateVal = active.submitted_at || active.created_at;
      const displayDate = dateVal 
        ? new Date(dateVal).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : "Recent";

      return {
        id: active.id,
        user_id: active.user_id,
        name: active.name || "Collection",
        reference_number: active.reference_number || null,
        project_name: active.project_name || null,
        customer_name: p?.full_name || inq?.customer_name || null,
        customer_email: p?.email ?? null,
        customer_phone: p?.phone_number || inq?.customer_phone || null,
        customer_profile_id: p?.id ?? null,
        products_count: itemCount.get(active.id) ?? 0,
        created_at: active.created_at,
        submitted_at: active.submitted_at || null,
        display_date: displayDate,
        whatsapp_sent: !!active.whatsapp_sent,
        is_locked: active.is_locked ?? Boolean(active.whatsapp_sent),
        version: active.version || 1,
        parent_collection_id: active.parent_collection_id || null,
        status: rawStatus,
        assigned_admin_id: inq?.assigned_admin_id ?? null,
        internal_notes: active.internal_notes ?? null,
        inquiry_id: inq?.id ?? null,
        history_count: customerColls.length,
      };
    });
    setRows(out);
    setBusy(false);
  };

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin]);

  const filtered = useMemo(() => filter === "all" ? rows : rows.filter((r) => r.status === filter), [rows, filter]);
  const byStage = useMemo(() => {
    const m: Record<Stage, Row[]> = { Draft: [], Sent: [], Viewed: [], Quoted: [], Negotiating: [], Approved: [], Completed: [], Cancelled: [] };
    rows.forEach((r) => {
      if (m[r.status]) m[r.status].push(r);
      else m["Draft"].push(r);
    });
    return m;
  }, [rows]);

  const setStage = async (row: Row, stage: Stage) => {
    try {
      await supabase.from("collections").update({ status: stage, inquiry_status: stage as any }).eq("id", row.id);
    } catch {
      await supabase.from("collections").update({ inquiry_status: stage as any }).eq("id", row.id);
    }
    if (row.inquiry_id) {
      await supabase.from("whatsapp_inquiries").update({ inquiry_status: stage as any }).eq("id", row.inquiry_id);
    }
    toast.success(`Updated stage to ${stage}`);
    void load();
  };

  const assign = async (row: Row, admin_id: string) => {
    if (!row.inquiry_id) return toast.error("No inquiry yet for this collection");
    const { error } = await supabase.from("whatsapp_inquiries").update({ assigned_admin_id: admin_id || null }).eq("id", row.inquiry_id);
    if (error) return toast.error(error.message);
    toast.success("Assigned admin successfully");
    void load();
  };

  const saveNotes = async (row: Row, notes: string) => {
    await supabase.from("collections").update({ internal_notes: notes }).eq("id", row.id);
    toast.success("Notes saved");
  };

  const openWorksheet = async (row: Row) => {
    setSelectedRow(row);
    const { data: colItems } = await supabase
      .from("collection_items")
      .select("*, products(name, code, price, brand, image_url)")
      .eq("collection_id", row.id);
    setSelectedItems(colItems ?? []);
  };

  if (loading || !isAdmin) return <div className="container-app py-8 text-sm text-muted-foreground">Loading CRM Worksheet…</div>;

  return (
    <div className="container-app py-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Collection CRM & Quotation Requests</h1>
          <p className="text-xs text-muted-foreground">Manage customer quotation requests, project specifications, and inquiry pipelines.</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setFilter("all")} className={`rounded px-2.5 py-1 text-xs font-medium ${filter === "all" ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>All ({rows.length})</button>
          {STAGES.map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`rounded px-2.5 py-1 text-xs font-medium ${filter === s ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"}`}>{s} ({byStage[s].length})</button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {STAGES.map((stage) => (
          <div key={stage} className="rounded-xl border border-border bg-card/50 p-2.5">
            <div className="mb-2 flex items-center justify-between border-b border-border/60 pb-1.5 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{stage}</span>
              <span className="rounded-full bg-surface-2 text-foreground text-[10px] font-bold px-1.5 py-0.5 border border-border">{byStage[stage].length}</span>
            </div>
            <div className="space-y-2">
              {byStage[stage].map((r) => (
                <div key={r.id} className="rounded-lg border border-border/80 bg-background p-3 text-xs shadow-sm hover:border-primary/40 transition space-y-2">
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-foreground block truncate text-sm">{r.customer_name || "Valued Client"}</span>
                      <span className="text-[11px] text-muted-foreground block truncate">{r.project_name || r.name}</span>
                      {r.customer_phone && <span className="text-[10px] text-primary/80 font-mono block truncate">{r.customer_phone}</span>}
                    </div>
                    {r.version > 1 ? (
                      <span className="rounded bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 border border-primary/20 shrink-0">v{r.version}</span>
                    ) : r.history_count > 1 ? (
                      <span className="rounded bg-muted text-muted-foreground text-[10px] font-medium px-1.5 py-0.5 border border-border shrink-0">{r.history_count} reqs</span>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-1.5">
                    <span className="font-semibold text-foreground">{r.products_count} Item{r.products_count === 1 ? "" : "s"}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{r.display_date}</span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Pipeline Status</label>
                      <select value={r.status} onChange={(e) => setStage(r, e.target.value as Stage)} className="w-full rounded border border-border bg-card px-2 py-1 text-[10px] font-medium">
                        {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Assigned Officer</label>
                      <select value={r.assigned_admin_id ?? ""} onChange={(e) => assign(r, e.target.value)} className="w-full rounded border border-border bg-card px-2 py-1 text-[10px]">
                        <option value="">Unassigned</option>
                        {admins.map((a) => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-1 text-[11px]">
                    <Link to="/admin/collections/$id" params={{ id: r.id }} className="inline-flex items-center gap-1 font-bold text-primary hover:underline">
                      <FileText className="h-3.5 w-3.5" /> Open Workspace →
                    </Link>
                    <Link to="/collection/$id" params={{ id: r.id }} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-[10px]">
                      <ExternalLink className="h-3 w-3" /> Customer View
                    </Link>
                  </div>
                </div>
              ))}
              {byStage[stage].length === 0 && !busy && <div className="text-[11px] text-muted-foreground/60 text-center py-4">— Empty —</div>}
            </div>
          </div>
        ))}
      </div>

      {/* CRM WORKSHEET MODAL / PANEL */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-semibold">{selectedRow.name} (v{selectedRow.version})</h3>
                  {selectedRow.reference_number && (
                    <span className="rounded-md bg-card text-foreground text-xs font-mono font-bold px-2 py-0.5 border border-border">
                      {selectedRow.reference_number}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Customer: {selectedRow.customer_name || selectedRow.customer_email || "Guest"}
                  {selectedRow.customer_phone && ` • Phone: ${selectedRow.customer_phone}`}
                </p>
              </div>
              <button onClick={() => setSelectedRow(null)} className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-surface-2">Close</button>
            </div>

            {/* Collection Items Breakdown */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Project Specification Worksheet</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedItems.map((item: any) => (
                  <div key={item.id} className="rounded-lg border border-border/80 p-3 bg-background text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold">
                      <span>{item.products?.name || "Product"} (Code: {item.products?.code})</span>
                      <span className="text-primary font-bold">{item.quantity || 1} {item.unit || "Pieces"}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground text-[11px]">
                      {item.installation_location && <div>Location: <strong className="text-foreground">{item.installation_location}</strong></div>}
                      {item.delivery_preference && <div>Delivery: <strong className="text-foreground">{item.delivery_preference}</strong></div>}
                      {item.installation_required && <div>Installation: <strong className="text-foreground">{item.installation_required}</strong></div>}
                      {item.project_notes && <div className="col-span-2">Notes: <strong className="text-foreground">{item.project_notes}</strong></div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Internal CRM Notes */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Internal Admin CRM Notes</label>
              <textarea
                defaultValue={selectedRow.internal_notes || ""}
                onBlur={(e) => saveNotes(selectedRow, e.target.value)}
                placeholder="Add internal notes e.g., Sent quote ₦1.2m on 05/08..."
                className="w-full rounded-lg border border-border bg-background p-2.5 text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                rows={3}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

