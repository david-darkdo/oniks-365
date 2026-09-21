import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/collection/$id")({
  head: () => ({
    meta: [
      { title: "Resolving Project Collection — ONIKS365" },
      { name: "description", content: "ONIKS365 Secure Project Collection Workspace resolver." },
    ],
  }),
  component: SmartCollectionResolver,
});

function SmartCollectionResolver() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [restricted, setRestricted] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    // CASE D: Unauthenticated visitor
    if (!user) {
      navigate({
        to: "/auth",
        search: { redirectTo: `/collection/${id}` },
        replace: true,
      });
      return;
    }

    // CASE A: Authenticated administrator lands directly in the exact customer workspace
    if (isAdmin) {
      navigate({
        to: "/admin/collections/$id",
        params: { id },
        replace: true,
      });
      return;
    }

    // Verify ownership BEFORE rendering any collection data
    const resolveOwnership = async () => {
      const { data: col, error } = await supabase
        .from("collections")
        .select("id, user_id")
        .eq("id", id)
        .maybeSingle();

      if (error || !col) {
        toast.error("Project collection record not found");
        navigate({ to: "/my-collections", replace: true });
        return;
      }

      // CASE B: Authenticated customer owner lands in My Collection History with exact request highlighted/opened
      if (col.user_id === user.id) {
        navigate({
          to: "/my-collections",
          search: { collection: id },
          replace: true,
        });
        return;
      }

      // CASE C: Authenticated non-owner (do not expose collection data)
      setRestricted(true);
      setChecking(false);
    };

    void resolveOwnership();
  }, [user, isAdmin, authLoading, id, navigate]);

  if (authLoading || checking) {
    return (
      <div className="container-app py-20 text-center space-y-4">
        <div className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Resolving secure collection workspace…
        </p>
      </div>
    );
  }

  // CASE C Render: Access Restricted State for authenticated non-owners
  return (
    <div className="container-app py-16 max-w-md text-center space-y-4">
      <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto" />
      <h2 className="font-display text-xl font-bold">Access Restricted</h2>
      <p className="text-xs text-muted-foreground leading-relaxed">
        This project collection belongs to another client workspace. You do not have permission to inspect this request.
      </p>
      <div className="pt-2 flex justify-center gap-3">
        <Link
          to="/my-collections"
          className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-xs"
        >
          View My Collections
        </Link>
        <Link
          to="/"
          className="rounded-lg border border-border px-4 py-2 text-xs font-bold hover:bg-muted transition"
        >
          Back to Showroom
        </Link>
      </div>
    </div>
  );
}
