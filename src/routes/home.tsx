import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useAppSettings, waLink } from "@/lib/settings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowRight,
  Facebook,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Sparkles,
  Compass,
  Bookmark,
  ShieldCheck,
  Building2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  Tv,
  Film,
  ExternalLink
} from "lucide-react";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "ONIKS365 — Premium Sanitary Ware & Modern Kitchen Solutions" },
      {
        name: "description",
        content:
          "ONIKS 365 LUXURY KITCHEN AND BATHROOMS FITTINGS — supplying premium sanitary ware, luxury bathroom fittings, and modern kitchen solutions across Nigeria.",
      },
      { property: "og:title", content: "ONIKS365 — Premium Kitchen & Bathroom Solutions" },
      {
        property: "og:description",
        content: "Discover contemporary bathroom fittings, sanitary ware, kitchen solutions, appliances, and smart storage systems designed to elevate modern spaces.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: s } = useAppSettings();
  const [categories, setCategories] = useState<any[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [showcaseVideos, setShowcaseVideos] = useState<any[]>([]);
  const [currentShowcaseIndex, setCurrentShowcaseIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  // Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // 1. Fetch categories
    const loadCategories = async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, slug, image_url, code_prefix")
        .order("name", { ascending: true })
        .limit(8);
      if (data) setCategories(data);
    };

    // 2. Fetch featured luxury products
    const loadFeatured = async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, price, code, product_media(url, is_primary)")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(6);
      if (data) setFeaturedProducts(data);
    };

    // 3. Fetch showcase media/videos
    const loadShowcase = async () => {
      const { data } = await supabase
        .from("showcase_media")
        .select("*")
        .eq("is_published", true)
        .eq("media_type", "video")
        .order("order_index", { ascending: true });
      if (data && data.length > 0) {
        setShowcaseVideos(data);
      }
    };

    void loadCategories();
    void loadFeatured();
    void loadShowcase();
  }, []);

  const handleNextShowcase = () => {
    if (showcaseVideos.length === 0) return;
    setCurrentShowcaseIndex((prev) => (prev + 1) % showcaseVideos.length);
  };

  const handlePrevShowcase = () => {
    if (showcaseVideos.length === 0) return;
    setCurrentShowcaseIndex((prev) => (prev - 1 + showcaseVideos.length) % showcaseVideos.length);
  };

  const submitQuickQuote = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const targetWa = s?.sales_whatsapp || "2348035186355";
      const text = `Hello ONIKS365! My name is ${name}. I am requesting a personalized consultation & catalog for modern kitchen solutions and bathroom fittings. (Phone: ${phone})`;
      window.open(waLink(targetWa, text), "_blank", "noopener,noreferrer");
      toast.success("Connecting with an ONIKS365 Consultant…");
      setName("");
      setPhone("");
    } catch {
      toast.error("Could not launch WhatsApp");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0B0C0E] via-[#121316] to-[#1A1D24] text-white py-16 sm:py-24 border-b border-[#C5A059]/30">
        {/* Background glow effects */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#ea580c]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="container-app relative z-10 grid gap-12 lg:grid-cols-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#C5A059]/40 bg-[#C5A059]/10 px-3.5 py-1 text-xs font-bold text-[#D4AF37] uppercase tracking-wider backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
              Luxury Kitchen & Bathroom Showroom
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15] uppercase">
              Elevate Your Space with <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C5A059]">Modern Luxury</span>
            </h1>

            <p className="text-sm sm:text-base text-gray-300 max-w-xl leading-relaxed">
              ONIKS 365 LUXURY KITCHEN AND BATHROOMS FITTINGS delivers curated collections of premium sanitary ware, modern kitchen solutions, designer faucets, and smart appliances engineered for lasting distinction.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#C5A059] to-[#D4AF37] px-6 py-3.5 text-sm font-bold text-[#0B0C0E] shadow-lg shadow-amber-500/20 hover:brightness-110 transition active:scale-95"
              >
                <Compass className="h-4 w-4" />
                <span>Explore Live Showroom</span>
              </Link>
              <Link
                to="/collection"
                search={{ autoPush: false }}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-bold text-white hover:bg-white/10 hover:border-white/40 transition backdrop-blur"
              >
                <Bookmark className="h-4 w-4 text-[#D4AF37]" />
                <span>My Project Workspace</span>
              </Link>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/10 max-w-lg">
              <div>
                <div className="font-display text-2xl font-bold text-[#D4AF37]">100%</div>
                <div className="text-[11px] text-gray-400 font-medium">Authentic Sanitary Ware</div>
              </div>
              <div>
                <div className="font-display text-2xl font-bold text-[#D4AF37]">Abuja & Lagos</div>
                <div className="text-[11px] text-gray-400 font-medium">Physical Distribution Hubs</div>
              </div>
              <div>
                <div className="font-display text-2xl font-bold text-[#D4AF37]">Nationwide</div>
                <div className="text-[11px] text-gray-400 font-medium">Secure Delivery</div>
              </div>
            </div>
          </div>

          {/* Hero Form / Quick Consultation Box */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-[#C5A059]/40 bg-[#121316]/90 p-6 sm:p-8 shadow-2xl backdrop-blur relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#ea580c]/10 rounded-full blur-2xl pointer-events-none" />
              
              <div className="space-y-2 mb-6">
                <h3 className="font-display text-xl font-bold text-white uppercase tracking-wide">
                  Request Project Consultation
                </h3>
                <p className="text-xs text-gray-400">
                  Building or renovating? Speak with our product specialists and receive an itemized quote on WhatsApp.
                </p>
              </div>

              <form onSubmit={submitQuickQuote} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Your Full Name
                  </label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Arc. Johnson or Engr. Musa"
                    className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-[#C5A059] focus:bg-white/10 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    WhatsApp Phone Number
                  </label>
                  <input
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 0803 123 4567"
                    className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-[#C5A059] focus:bg-white/10 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg bg-gradient-to-r from-[#25D366] to-[#1EBE5D] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 hover:brightness-105 transition disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>{busy ? "Opening WhatsApp…" : "Chat with Specialist Now"}</span>
                </button>
              </form>

              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#D4AF37]" /> Verified CAC Registered
                </span>
                <span>Dei-Dei Abuja • Coker Lagos</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Grid (Kitchen & Bathroom Focus) */}
      <section className="container-app py-16 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E5E0D8] pb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#ea580c]">
              Curated Collections
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0F1115] uppercase tracking-tight mt-1">
              Explore by Category
            </h2>
          </div>
          <Link
            to="/"
            className="text-xs font-bold text-[#ea580c] hover:text-amber-700 inline-flex items-center gap-1.5 transition"
          >
            <span>View All Categories</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to="/"
              search={{ category: cat.slug }}
              className="group relative overflow-hidden rounded-xl border border-[#E5E0D8] bg-[#FAF8F5] p-4 sm:p-5 transition-all duration-300 hover:shadow-xl hover:border-[#C5A059] hover:-translate-y-1"
            >
              <div className="aspect-square w-full rounded-lg overflow-hidden bg-white mb-3 flex items-center justify-center border border-[#E5E0D8]/60">
                {cat.image_url ? (
                  <img
                    src={cat.image_url}
                    alt={cat.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <div className="text-gray-300 font-display font-bold text-xs uppercase tracking-widest text-center px-2">
                    {cat.name}
                  </div>
                )}
              </div>
              <h3 className="font-bold text-sm text-[#0F1115] group-hover:text-[#ea580c] transition line-clamp-1">
                {cat.name}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Browse Fittings & Sinks
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Trust Pillars */}
      <section className="bg-white border-y border-[#E5E0D8] py-12">
        <div className="container-app grid gap-8 md:grid-cols-3">
          <div className="flex items-start gap-4 p-4 rounded-xl border border-[#E5E0D8] bg-[#FAF8F5]">
            <Building2 className="h-8 w-8 text-[#ea580c] shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-[#0F1115]">Premium Kitchen & Bathroom Solutions</h4>
              <p className="text-xs text-muted-foreground mt-1">Direct supplier of luxury sanitary ware, bathroom fittings, appliances, and space-saving kitchen storage.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 rounded-xl border border-[#E5E0D8] bg-[#FAF8F5]">
            <ShieldCheck className="h-8 w-8 text-[#D4AF37] shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-[#0F1115]">CAC Registered Company</h4>
              <p className="text-xs text-muted-foreground mt-1">Officially registered Nigerian entity (ONIKS 365 LUXURY KITCHEN AND BATHROOMS FITTINGS) serving Abuja, Lagos & nationwide.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 rounded-xl border border-[#E5E0D8] bg-[#FAF8F5]">
            <MessageCircle className="h-8 w-8 text-[#ea580c] shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-[#0F1115]">Instant WhatsApp Consultation</h4>
              <p className="text-xs text-muted-foreground mt-1">Curate your project lookbook and receive formatted WhatsApp quotes instantly from our team.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Showcase Video Slider (Continuous Showcase) */}
      {showcaseVideos.length > 0 && (
        <section className="bg-[#0B0C0E] text-white py-12 border-y border-[#C5A059]/30 shadow-2xl relative overflow-hidden">
          {/* Ambient Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="container-app space-y-6 relative z-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.25em] text-[#D4AF37]">
                  <Film className="h-3.5 w-3.5 text-[#D4AF37]" /> Digital Showcase Reel
                </div>
                <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white uppercase tracking-tight mt-1">
                  ONIKS365 Video Showcase
                </h3>
              </div>
              <p className="text-xs text-slate-400 max-w-md">
                Watch our product videos, luxury WCs, smart showers, kitchen sinks, built-in ovens, and modern storage systems.
              </p>
            </div>

            {/* Video Player Box */}
            <div className="relative w-full aspect-video max-h-[550px] rounded-2xl overflow-hidden bg-slate-900 border border-white/15 shadow-2xl group">
              <video
                key={showcaseVideos[currentShowcaseIndex]?.id || currentShowcaseIndex}
                src={showcaseVideos[currentShowcaseIndex]?.media_url}
                poster={showcaseVideos[currentShowcaseIndex]?.thumbnail_url}
                autoPlay
                playsInline
                loop
                muted={isMuted}
                className="w-full h-full object-cover"
              />

              {/* Title & Overlay Information */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
              
              <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                <span className="bg-[#C5A059] text-black text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow">
                  Showcase {currentShowcaseIndex + 1} of {showcaseVideos.length}
                </span>
                <span className="text-xs font-semibold text-white drop-shadow">
                  {showcaseVideos[currentShowcaseIndex]?.title}
                </span>
              </div>

              {/* Controls Bar */}
              <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-2.5 rounded-full bg-black/60 hover:bg-[#C5A059] hover:text-black text-white backdrop-blur transition shadow"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                  <span className="text-[11px] text-gray-300 font-medium">
                    {isMuted ? "Click to Unmute Sound" : "Audio Active"}
                  </span>
                </div>

                {/* Slider navigation */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevShowcase}
                    className="p-2.5 rounded-full bg-black/60 hover:bg-[#C5A059] hover:text-black text-white backdrop-blur transition shadow"
                    title="Previous Video"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleNextShowcase}
                    className="p-2.5 rounded-full bg-black/60 hover:bg-[#C5A059] hover:text-black text-white backdrop-blur transition shadow"
                    title="Next Video"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Video Thumbnail Selector */}
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {showcaseVideos.map((v, idx) => (
                <button
                  key={v.id || idx}
                  onClick={() => setCurrentShowcaseIndex(idx)}
                  className={`relative shrink-0 w-28 sm:w-36 aspect-video rounded-lg overflow-hidden border-2 transition ${
                    idx === currentShowcaseIndex
                      ? "border-[#D4AF37] ring-2 ring-[#D4AF37]/50"
                      : "border-white/20 opacity-60 hover:opacity-100"
                  }`}
                >
                  <img
                    src={v.thumbnail_url || "/placeholder.svg"}
                    alt={v.title || `Video ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <Play className="h-3 w-3 text-white fill-white" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Luxury Pieces Grid */}
      <section className="container-app py-16 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E5E0D8] pb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#ea580c]">
              Direct Showroom Inventory
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0F1115] uppercase tracking-tight mt-1">
              Featured Luxury Highlights
            </h2>
          </div>
          <Link
            to="/"
            className="text-xs font-bold text-[#ea580c] hover:text-amber-700 inline-flex items-center gap-1.5 transition"
          >
            <span>Browse Full Catalog</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {featuredProducts.map((p) => {
            const primaryImg = p.product_media?.find((m: any) => m.is_primary)?.url || p.product_media?.[0]?.url;
            return (
              <Link
                key={p.id}
                to="/product/$slug"
                params={{ slug: p.slug }}
                className="group flex flex-col justify-between rounded-xl border border-[#E5E0D8] bg-white p-3 shadow-xs hover:border-[#C5A059] hover:shadow-lg transition"
              >
                <div>
                  <div className="aspect-square w-full rounded-lg bg-[#FAF8F5] overflow-hidden mb-2.5 relative border border-[#E5E0D8]/40">
                    {primaryImg ? (
                      <img
                        src={primaryImg}
                        alt={p.name}
                        className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[10px] text-gray-400 font-bold uppercase">
                        No Image
                      </div>
                    )}
                    {p.code && (
                      <span className="absolute top-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#D4AF37] backdrop-blur">
                        {p.code}
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-xs text-[#0F1115] line-clamp-2 group-hover:text-[#ea580c] transition">
                    {p.name}
                  </h4>
                </div>
                <div className="mt-3 pt-2 border-t border-[#E5E0D8] flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#D4AF37]">
                    {p.price > 0 ? `₦${Number(p.price).toLocaleString()}` : "Price On Request"}
                  </span>
                  <span className="text-[10px] font-bold text-[#ea580c] group-hover:translate-x-0.5 transition">
                    →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Showroom Visit / Locations CTA */}
      <section className="bg-[#FAF8F5] border-t border-[#E5E0D8] py-16">
        <div className="container-app grid gap-12 lg:grid-cols-2 items-center">
          <div className="space-y-6">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#ea580c]">
              Physical Distribution Hubs
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[#0F1115] uppercase tracking-tight">
              Visit Our Experience Centers in Abuja & Lagos
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              We welcome architects, builders, interior designers, and discerning homeowners to inspect our fixtures in person. Experience the tactile weight and water-flow mechanics of our luxury fittings before purchase.
            </p>

            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-xl border border-[#E5E0D8] bg-white space-y-1">
                <div className="flex items-center gap-2 font-bold text-sm text-[#0F1115]">
                  <MapPin className="h-4 w-4 text-[#ea580c]" /> Abuja Showroom & Warehouse
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  {s?.company_address || "69/243 Cornershop International Building Materials Market, Dei-Dei, Abuja FCT, Nigeria"}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-[#E5E0D8] bg-white space-y-1">
                <div className="flex items-center gap-2 font-bold text-sm text-[#0F1115]">
                  <Building2 className="h-4 w-4 text-[#ea580c]" /> Lagos Commercial Distribution Hub
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  Odunade Building Materials Market, Coker, Orile, Badagry Expressway, Lagos, Nigeria
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-lg bg-[#0F1115] px-6 py-3.5 text-xs font-bold text-white hover:bg-[#1A1D24] hover:text-[#D4AF37] transition shadow"
              >
                <Phone className="h-4 w-4 text-[#D4AF37]" />
                <span>Contact Showroom Reps</span>
              </Link>
            </div>
          </div>

          {/* Quick Inquiry Form */}
          <form onSubmit={submitQuickQuote} className="rounded-2xl border border-[#E5E0D8] bg-white p-6 sm:p-8 shadow-md">
            <div>
              <h3 className="font-display text-lg font-bold text-[#0F1115] uppercase">
                Schedule a Private Walkthrough
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Let us prepare spec sheets and samples prior to your arrival at our showroom.
              </p>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F1115] mb-1">Your Full Name</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full Name / Company"
                    className="w-full rounded-lg border border-[#E5E0D8] bg-[#FAF8F5] px-3.5 py-2.5 text-sm outline-none focus:border-[#C5A059] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0F1115] mb-1">Phone / WhatsApp Number</label>
                  <input
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone Number"
                    className="w-full rounded-lg border border-[#E5E0D8] bg-[#FAF8F5] px-3.5 py-2.5 text-sm outline-none focus:border-[#C5A059] focus:bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                disabled={busy}
                className="w-full rounded-lg bg-[#0F1115] border border-[#C5A059]/40 px-5 py-3 text-sm font-bold text-white hover:bg-[#1A1D24] hover:text-[#D4AF37] disabled:opacity-60 transition shadow-sm"
              >
                {busy ? "Connecting…" : "Send WhatsApp Request"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </AppShell>
  );
}
