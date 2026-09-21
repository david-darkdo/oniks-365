import { generateCollectionReference } from "./collection";

export function normalizePhone(p?: string | null): string {
  if (!p) return "";
  const cleaned = String(p).replace(/[^\d+]/g, "").trim();
  return cleaned.length >= 7 ? cleaned : "";
}

export function normalizeEmail(e?: string | null): string {
  if (!e) return "";
  const trimmed = String(e).trim().toLowerCase();
  return trimmed.includes("@") ? trimmed : "";
}

export function getCustomerIdentityKey(col: any, inq?: any): string {
  if (col?.user_id) {
    return `user:${col.user_id}`;
  }
  const phone = normalizePhone(inq?.customer_phone || inq?.whatsapp_number);
  if (phone) {
    return `phone:${phone}`;
  }
  const email = normalizeEmail(inq?.customer_email);
  if (email) {
    return `email:${email}`;
  }
  return `guest:${col?.id || "unknown"}`;
}

export interface CustomerGroup {
  key: string;
  userId: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerProfile: any | null;
  accountCreatedAt: string | null;
  collections: any[];
  submittedCollections: any[];
  totalRequestsCount: number;
  latestRequest: any;
  latestReference: string;
  latestProjectName: string;
  latestSubmittedDate: string;
  latestProductsCount: number;
  latestStage: string;
  latestCollectionId: string;
}

/**
 * Authoritative Customer Identity Grouping
 * 
 * ONE CUSTOMER = ONE CARD
 * Guarantees that the Command Center and Customer Workspace agree 100% on:
 * - Customer identity
 * - Request count
 * - Request history
 */
export function groupCollectionsByCustomer(
  colls: any[],
  profs: any[],
  inqs: any[],
  itemCount: Map<string, number>
): CustomerGroup[] {
  const inqByColl = new Map<string, any>();
  (inqs || []).forEach((i: any) => {
    if (i?.collection_id) inqByColl.set(i.collection_id, i);
  });

  const profByAuth = new Map<string, any>();
  (profs || []).forEach((p: any) => {
    if (p?.auth_id) profByAuth.set(p.auth_id, p);
  });

  const groups = new Map<string, any[]>();

  (colls || []).forEach((c: any) => {
    const inq = inqByColl.get(c.id);
    const key = getCustomerIdentityKey(c, inq);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  });

  const result: CustomerGroup[] = [];

  for (const [key, customerColls] of groups.entries()) {
    // Separate submitted collections from active drafts
    const submitted = customerColls.filter(
      (c) => c.submitted_at || c.is_locked || c.status === "Submitted"
    );

    // Sort submitted collections latest first
    submitted.sort((a, b) => {
      const timeA = new Date(a.submitted_at || a.created_at).getTime();
      const timeB = new Date(b.submitted_at || b.created_at).getTime();
      return timeB - timeA;
    });

    // Sort all collections
    customerColls.sort((a, b) => {
      const timeA = new Date(a.submitted_at || a.created_at).getTime();
      const timeB = new Date(b.submitted_at || b.created_at).getTime();
      return timeB - timeA;
    });

    // Section 6: Latest Request is latest valid submitted request (or newest draft if none submitted)
    const latest = submitted[0] || customerColls[0];
    const latestInq = inqByColl.get(latest.id);

    // Find profile
    const profile = latest.user_id ? profByAuth.get(latest.user_id) : null;

    // Resolve contact information
    const rawName = profile?.full_name || latestInq?.customer_name || (customerColls.find(c => inqByColl.get(c.id)?.customer_name) ? inqByColl.get(customerColls.find(c => inqByColl.get(c.id)?.customer_name)!.id)?.customer_name : null) || "Guest Client";
    const customerName = String(rawName).trim() || "Guest Client";

    const customerEmail = profile?.email || latestInq?.customer_email || (customerColls.find(c => inqByColl.get(c.id)?.customer_email) ? inqByColl.get(customerColls.find(c => inqByColl.get(c.id)?.customer_email)!.id)?.customer_email : null) || null;

    const customerPhone = latestInq?.customer_phone || latestInq?.whatsapp_number || (customerColls.find(c => inqByColl.get(c.id)?.customer_phone) ? inqByColl.get(customerColls.find(c => inqByColl.get(c.id)?.customer_phone)!.id)?.customer_phone : null) || null;

    const latestRef = latest.reference_number || generateCollectionReference(latest.id);
    const latestProject = latest.project_name || latest.name || "Showroom Project";
    
    const dateVal = latest.submitted_at || latest.created_at;
    const latestSubmittedDate = dateVal
      ? new Date(dateVal).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : "Recent";

    const latestStage = latest.status || (latest.is_locked ? "Submitted" : "Draft");

    result.push({
      key,
      userId: latest.user_id || null,
      customerName,
      customerEmail,
      customerPhone,
      customerProfile: profile || null,
      accountCreatedAt: profile?.created_at || null,
      collections: customerColls,
      submittedCollections: submitted,
      totalRequestsCount: customerColls.length,
      latestRequest: latest,
      latestReference: latestRef,
      latestProjectName: latestProject,
      latestSubmittedDate,
      latestProductsCount: itemCount.get(latest.id) ?? 0,
      latestStage,
      latestCollectionId: latest.id,
    });
  }

  // Sort customer cards so customer with latest activity is at the top
  result.sort((a, b) => {
    const timeA = new Date(a.latestRequest.submitted_at || a.latestRequest.created_at).getTime();
    const timeB = new Date(b.latestRequest.submitted_at || b.latestRequest.created_at).getTime();
    return timeB - timeA;
  });

  return result;
}
