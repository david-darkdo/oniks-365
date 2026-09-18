import { useEffect, useState } from "react";
import { Plus, Check } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  addGuestItem,
  addItemToUserCollection,
  addItemToUserCollectionSync,
  getGuestCollection,
  getCachedUserCollectionItems,
  removeGuestItem,
  removeItemFromUserCollection,
  removeItemFromUserCollectionSync,
} from "@/lib/collection";

export function AddToCollectionButton({
  productId,
  className,
  compact = false,
}: {
  productId: string;
  className?: string;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const refresh = () => {
      if (user) {
        const cached = getCachedUserCollectionItems(user.id);
        setAdded(cached.items.some((i: any) => i.product_id === productId));
      } else {
        setAdded(getGuestCollection().some((i: any) => i.product_id === productId));
      }
    };
    refresh();
    window.addEventListener("collection:change", refresh);
    return () => {
      window.removeEventListener("collection:change", refresh);
    };
  }, [productId, user]);

  const onClick = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const nextState = !added;
    setAdded(nextState); // Instant synchronous visual toggle (<0.1ms)

    try {
      if (!user) {
        if (nextState) {
          addGuestItem(productId);
          const currentCount = getGuestCollection().length;
          toast.success(`+${currentCount}`, {
            description: "Sign in to sync across devices.",
            action: { label: "Sign in", onClick: () => navigate({ to: "/auth" }) },
          });
        } else {
          removeGuestItem(productId);
        }
      } else {
        if (nextState) {
          // 1. Instant local sync (<0.1ms)
          const cached = addItemToUserCollectionSync(user.id, productId);
          toast.success(`+${cached.items.length}`);
          // 2. Non-blocking background database sync
          void addItemToUserCollection(user.id, productId);
        } else {
          // 1. Instant local sync (<0.1ms)
          removeItemFromUserCollectionSync(user.id, productId);
          // 2. Non-blocking background database sync
          void removeItemFromUserCollection(user.id, productId);
        }
      }
    } catch (e) {
      console.error(e);
      setAdded(!nextState); // Rollback state on error
      toast.error("Couldn't update collection");
    }
  };

  const Icon = added ? Check : Plus;
  const labelText = added ? "Added" : compact ? "+ Add" : "Add to Collection";

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        className ??
        `flex flex-1 items-center justify-center gap-1 rounded-md border ${
          added
            ? "border-[#C5A059] bg-[#C5A059]/15 text-[#ea580c] font-bold shadow-xs"
            : "border-[#E5E0D8] bg-[#FAF8F5] text-[#0F1115] hover:border-[#C5A059] hover:text-[#ea580c] font-semibold"
        } px-2.5 py-1.5 text-[11px] transition-all duration-150 active:scale-95`
      }
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{labelText}</span>
    </button>
  );
}
