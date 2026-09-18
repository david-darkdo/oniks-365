import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Search,
  Compass,
  Bookmark,
  User,
  LogOut,
  Shield,
  Bell,
  X,
  AlertCircle,
  Trash2,
  Truck,
  CreditCard,
  Headphones,
  HelpCircle,
  Phone
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { FloatingWhatsApp } from "./FloatingWhatsApp";
import { syncOfflineActions, getGuestCollection, getCachedUserCollectionItems } from "@/lib/collection";
import { toast } from "sonner";
import { SiteFooter } from "./SiteFooter";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [trustFeatures, setTrustFeatures] = useState<any[]>([]);

  useEffect(() => {
    const fetchTrust = async () => {
      const { data } = await supabase
        .from("trust_features")
        .select("*")
        .order("order_index", { ascending: true });
      if (data) setTrustFeatures(data);
    };
    void fetchTrust();
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      toast.success("Connection restored! Syncing offline actions...");
      void syncOfflineActions();
    };
    const handleOffline = () => {
      toast.warning("Connection lost. Running in offline resilience mode.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (navigator.onLine) {
      void syncOfflineActions();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <TopBar />
      <main className="flex-1 pb-16 md:pb-6">{children}</main>

      {/* Seamless Scrolling Marquee Trust Ticker Belt */}
      {trustFeatures.length > 0 && (
        <section className="fixed bottom-12 md:bottom-0 left-0 right-0 z-20 border-t border-[#C5A059]/20 bg-[#14161B]/95 py-2.5 shadow-md overflow-hidden backdrop-blur select-none text-gray-200">
          <style>{`
            @keyframes marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .animate-marquee {
              display: flex;
              width: max-content;
              animation: marquee 30s linear infinite;
            }
          `}</style>
          
          <div className="animate-marquee flex items-center gap-16 px-4">
            {/* First Set */}
            {trustFeatures.map((t) => {
              const IconComponent =
                t.icon_name === "Shield" ? Shield :
                t.icon_name === "Truck" ? Truck :
                t.icon_name === "CreditCard" ? CreditCard :
                t.icon_name === "Headphones" ? Headphones : HelpCircle;
              return (
                <div key={`${t.id}-1`} className="flex gap-2.5 items-center shrink-0">
                  <div className="rounded-full bg-[#C5A059]/15 p-1.5 text-[#D4AF37] shrink-0 border border-[#C5A059]/30">
                    <IconComponent className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex items-baseline gap-1.5">
                    <h4 className="font-bold text-[11px] text-white tracking-tight whitespace-nowrap">{t.title}</h4>
                    <span className="text-[10px] text-[#C5A059]/50 font-bold font-mono">|</span>
                    <p className="text-[10px] text-gray-300 whitespace-nowrap">{t.description}</p>
                  </div>
                </div>
              );
            })}
            
            {/* Duplicated Second Set for Seamless Loop */}
            {trustFeatures.map((t) => {
              const IconComponent =
                t.icon_name === "Shield" ? Shield :
                t.icon_name === "Truck" ? Truck :
                t.icon_name === "CreditCard" ? CreditCard :
                t.icon_name === "Headphones" ? Headphones : HelpCircle;
              return (
                <div key={`${t.id}-2`} className="flex gap-2.5 items-center shrink-0">
                  <div className="rounded-full bg-[#C5A059]/15 p-1.5 text-[#D4AF37] shrink-0 border border-[#C5A059]/30">
                    <IconComponent className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex items-baseline gap-1.5">
                    <h4 className="font-bold text-[11px] text-white tracking-tight whitespace-nowrap">{t.title}</h4>
                    <span className="text-[10px] text-[#C5A059]/50 font-bold font-mono">|</span>
                    <p className="text-[10px] text-gray-300 whitespace-nowrap">{t.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <SiteFooter />
      <FloatingWhatsApp />
      <BottomNav />
    </div>
  );
}

function TopBar() {
  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search as { q?: string } });
  const { user, isAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("communication_queue")
      .select("*")
      .eq("user_id", user.id)
      .eq("channel_type", "push")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) {
      setNotifications(data);
      const pending = data.filter(n => n.status === "PENDING").length;
      setUnreadCount(pending);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    void loadNotifications();

    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "communication_queue",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void loadNotifications();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const openNotifications = async () => {
    setShowNotifications(!showNotifications);
    setMenuOpen(false);
    if (!showNotifications && user?.id) {
      await supabase
        .from("communication_queue")
        .update({ status: "DELIVERED" })
        .eq("user_id", user.id)
        .eq("channel_type", "push")
        .eq("status", "PENDING");
      setUnreadCount(0);
    }
  };

  const clearNotification = async (id: string) => {
    await supabase.from("communication_queue").delete().eq("id", id);
    void loadNotifications();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[#C5A059]/30 bg-[#0F1115] text-white backdrop-blur shadow-md">
      <div className="container-app flex items-center gap-4 py-3">
        <Link to="/" className="flex items-center gap-3 group">
          <img
            src="/logo.png"
            alt="ONIKS365 Logo"
            className="h-9 w-auto object-contain transition group-hover:scale-105"
          />
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold tracking-tight text-[#ea580c] leading-none">
              ONIKS365
            </span>
            <span className="hidden text-[9px] font-semibold tracking-wider text-[#D4AF37] uppercase sm:block mt-0.5">
              ONIKS 365 LUXURY KITCHEN AND BATHROOMS FITTINGS
            </span>
          </div>
        </Link>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const q = String(data.get("q") || "").trim();
            navigate({ to: "/search", search: { q } });
          }}
          className="relative flex-1"
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={search?.q ?? ""}
            placeholder="Search Sanitary Ware, Kitchen Sinks, Showers & Fittings…"
            className="w-full rounded-full border border-white/20 bg-white/10 py-2 pl-10 pr-4 text-sm text-white placeholder-gray-400 outline-none transition focus:border-[#C5A059] focus:bg-white/15 focus:ring-1 focus:ring-[#C5A059]"
          />
        </form>
        
        {/* Desktop Quick Navigation Links (Laptop / Monitor view) */}
        <nav className="hidden md:flex items-center gap-1.5 shrink-0">
          <Link
            to="/home"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-gray-200 hover:bg-[#C5A059]/20 hover:text-[#D4AF37] hover:border-[#C5A059] transition shadow-xs"
          >
            <Home className="h-3.5 w-3.5 text-[#D4AF37]" />
            <span>Home</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-gray-200 hover:bg-[#C5A059]/20 hover:text-[#D4AF37] hover:border-[#C5A059] transition shadow-xs"
          >
            <Compass className="h-3.5 w-3.5 text-[#D4AF37]" />
            <span>Showroom</span>
          </Link>
          <Link
            to="/collection"
            search={{ autoPush: false }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-gray-200 hover:bg-[#C5A059]/20 hover:text-[#D4AF37] hover:border-[#C5A059] transition shadow-xs"
          >
            <Bookmark className="h-3.5 w-3.5 text-[#D4AF37]" />
            <span>Workspace</span>
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-gray-200 hover:bg-[#C5A059]/20 hover:text-[#D4AF37] hover:border-[#C5A059] transition shadow-xs"
          >
            <Phone className="h-3.5 w-3.5 text-[#D4AF37]" />
            <span>Contact</span>
          </Link>
        </nav>

        <div className="flex items-center gap-2.5">
          {/* Notification Bell */}
          {user && (
            <div className="relative">
              <button
                onClick={openNotifications}
                className="relative grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/10 text-[#D4AF37] transition hover:border-[#C5A059]"
              >
                <Bell className="h-4 w-4 text-[#D4AF37]" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#ea580c] text-[8px] font-bold text-white shadow-sm animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div 
                    onClick={() => setShowNotifications(false)}
                    className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
                  />
                  
                  <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[340px] rounded-xl border border-[#C5A059]/30 bg-[#121316] text-white shadow-2xl p-4 text-xs space-y-3 z-50 md:absolute md:top-auto md:left-auto md:right-0 md:translate-x-0 md:translate-y-0 md:mt-2 md:w-80 md:rounded-lg md:shadow-xl md:p-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="font-bold text-[#D4AF37] text-sm md:text-xs">Notifications</span>
                      <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10"><X className="h-4 w-4" /></button>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {notifications.map((notif) => (
                        <div key={notif.id} className="p-2.5 border border-white/10 rounded bg-white/5 flex gap-2 relative group text-left">
                          <AlertCircle className="h-4 w-4 text-[#D4AF37] shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white truncate">{notif.subject || "Alert"}</div>
                            <p className="text-[10px] text-gray-300 mt-0.5 leading-tight">{notif.body}</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); clearNotification(notif.id); }}
                            className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      {notifications.length === 0 && (
                        <div className="text-gray-400 italic text-center py-4">No notifications yet.</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Account Menu */}
          <div className="relative">
            <button
              onClick={() => {
                setMenuOpen((o) => !o);
                setShowNotifications(false);
              }}
              aria-label="Account menu"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/10 text-[#D4AF37] hover:border-[#C5A059]"
            >
              <User className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-lg border border-[#C5A059]/30 bg-[#121316] py-1.5 shadow-2xl z-50 text-gray-200">
                <Link
                  to="/collection"
                  search={{ autoPush: false }}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-white/10 hover:text-[#D4AF37]"
                >
                  <Bookmark className="h-4 w-4 text-[#D4AF37]" />
                  <span>Active Workspace</span>
                </Link>
                <Link
                  to="/my-collections"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-white/10 hover:text-[#D4AF37]"
                >
                  <Bookmark className="h-4 w-4 text-[#ea580c]" />
                  <span>Collection History</span>
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-white/10 hover:text-[#D4AF37]"
                  >
                    <Shield className="h-4 w-4 text-[#D4AF37]" />
                    <span>Admin Command Center</span>
                  </Link>
                )}
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const { user } = useAuth();
  const searchState = useRouterState({ select: (s) => s.location.pathname });
  
  const [collectionCount, setCollectionCount] = useState(0);

  const loadCollectionCount = useCallback(() => {
    if (user?.id) {
      const cached = getCachedUserCollectionItems(user.id);
      setCollectionCount(cached.items.length);
    } else {
      setCollectionCount(getGuestCollection().length);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadCollectionCount();
    window.addEventListener("collection:change", loadCollectionCount);
    return () => {
      window.removeEventListener("collection:change", loadCollectionCount);
    };
  }, [loadCollectionCount]);

  const nav = [
    { to: "/home" as const, label: "Home", icon: Home, active: searchState === "/home" },
    { to: "/search" as const, label: "Search", icon: Search, active: searchState.startsWith("/search") },
    { to: "/" as const, label: "Feed", icon: Compass, active: searchState === "/" },
    { to: "/collection" as const, label: "Collection", icon: Bookmark, active: searchState.startsWith("/collection") },
    { to: user ? ("/account" as const) : ("/auth" as const), label: "Account", icon: User, active: searchState.startsWith("/account") || searchState.startsWith("/auth") },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#C5A059]/30 bg-[#0F1115]/95 py-2 backdrop-blur md:hidden">
      <div className="flex justify-around">
        {nav.map((t) => (
          <Link
            key={t.label}
            to={t.to}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-medium transition ${
              t.active ? "text-[#ea580c] font-bold" : "text-gray-400 hover:text-white"
            }`}
          >
            <div className="relative">
              <t.icon className="h-5 w-5" />
              {t.label === "Collection" && collectionCount > 0 && (
                <span className="absolute -top-1.5 -right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#ea580c] text-[8px] font-bold text-white shadow-sm">
                  +{collectionCount}
                </span>
              )}
            </div>
            <span>{t.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
