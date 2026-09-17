import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAppSettings, waLink } from "@/lib/settings";
import { toast } from "sonner";
import { Facebook, Instagram, Mail, MapPin, MessageCircle, Phone, Building2, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — ONIKS 365 LUXURY KITCHEN AND BATHROOMS FITTINGS" },
      { name: "description", content: "Contact ONIKS 365 LUXURY KITCHEN AND BATHROOMS FITTINGS in Abuja and Lagos. Trusted supplier of premium kitchen solutions and luxury bathroom fittings across Nigeria." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { data: s } = useAppSettings();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const targetWa = s?.sales_whatsapp || "2348035186355";
      const inquiryText = msg.trim()
        ? `Hello ONIKS365! My name is ${name}. Inquiring about: ${msg.trim()} (Phone: ${phone}).`
        : `Hello ONIKS365! My name is ${name}. I would like to inquire about your premium kitchen and bathroom solutions at ${phone}.`;
      window.open(waLink(targetWa, inquiryText), "_blank", "noopener,noreferrer");
      toast.success("Opening WhatsApp Sales Consultation…");
      setName(""); setPhone(""); setMsg("");
    } catch {
      toast.error("Couldn't open WhatsApp");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="container-app py-10 space-y-8">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600">Corporate Offices & Showrooms</span>
          <h1 className="font-display text-3xl font-extrabold text-foreground mt-1">ONIKS 365 LUXURY KITCHEN AND BATHROOMS FITTINGS</h1>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Oniks365 is a proudly Nigerian, CAC-registered company. We are a trusted supplier of premium modern kitchen solutions and luxury bathroom fittings across Nigeria.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            {s?.map_url ? (
              <a
                href={s.map_url}
                target="_blank"
                rel="noopener noreferrer"
                title="Open location in Google Maps"
                className="block rounded-xl border border-border bg-white p-5 shadow-xs hover:border-amber-600 hover:shadow-md transition cursor-pointer group"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Abuja Showroom</span>
                      <div className="font-bold text-sm text-foreground group-hover:text-amber-600 transition">{s.company_address || "69/243 Cornershop International Building Materials Market"}</div>
                      <p className="text-xs text-muted-foreground mt-0.5">Dei-Dei, Abuja FCT, Nigeria</p>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-amber-600 opacity-70 group-hover:opacity-100 transition shrink-0" />
                </div>
              </a>
            ) : (
              <div className="rounded-xl border border-border bg-white p-5 shadow-xs space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Abuja Showroom</span>
                    <div className="font-bold text-sm text-foreground">{s?.company_address || "69/243 Cornershop International Building Materials Market"}</div>
                    <p className="text-xs text-muted-foreground mt-0.5">Dei-Dei, Abuja FCT, Nigeria</p>
                  </div>
                </div>
              </div>
            )}

            {s?.map_url ? (
              <a
                href={s.map_url}
                target="_blank"
                rel="noopener noreferrer"
                title="Open location in Google Maps"
                className="block rounded-xl border border-border bg-white p-5 shadow-xs hover:border-amber-600 hover:shadow-md transition cursor-pointer group"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Building2 className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Lagos Office</span>
                      <div className="font-bold text-sm text-foreground group-hover:text-amber-600 transition">Odunade Building Materials Market</div>
                      <p className="text-xs text-muted-foreground mt-0.5">Coker, Orile, Badagry Expressway, Lagos, Nigeria</p>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-amber-600 opacity-70 group-hover:opacity-100 transition shrink-0" />
                </div>
              </a>
            ) : (
              <div className="rounded-xl border border-border bg-white p-5 shadow-xs space-y-3">
                <div className="flex items-start gap-3">
                  <Building2 className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Lagos Office</span>
                    <div className="font-bold text-sm text-foreground">Odunade Building Materials Market</div>
                    <p className="text-xs text-muted-foreground mt-0.5">Coker, Orile, Badagry Expressway, Lagos, Nigeria</p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-start gap-3">
                <Phone className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Nationwide Delivery & Payment</span>
                  <div className="font-bold text-sm text-foreground">Nationwide delivery across Nigeria</div>
                  <p className="text-xs text-emerald-700 font-medium mt-0.5">Payment on delivery available in Abuja and Lagos</p>
                </div>
              </div>
            </div>

            {s?.company_email && (
              <a href={`mailto:${s.company_email}`} className="flex items-center gap-3 rounded-xl border border-border bg-white p-5 shadow-xs hover:border-amber-600 transition">
                <Mail className="h-6 w-6 text-amber-600 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Email Address</span>
                  <div className="font-bold text-sm text-foreground">{s.company_email}</div>
                </div>
              </a>
            )}
          </div>

          <form onSubmit={submit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-[#0F1115] mb-1">Your Full Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                className="w-full rounded-lg border border-[#E5E0D8] bg-[#FAF8F5] px-3.5 py-2 text-xs outline-none focus:border-[#C5A059] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F1115] mb-1">Phone Number / WhatsApp</label>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone Number"
                className="w-full rounded-lg border border-[#E5E0D8] bg-[#FAF8F5] px-3.5 py-2 text-xs outline-none focus:border-[#C5A059] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F1115] mb-1">Inquiry / Project Details</label>
              <textarea
                rows={3}
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="Tell us what product or project you need assistance with…"
                className="w-full rounded-lg border border-[#E5E0D8] bg-[#FAF8F5] px-3.5 py-2 text-xs outline-none focus:border-[#C5A059] focus:bg-white resize-none"
              />
            </div>

            <button
              disabled={busy}
              className="w-full rounded-lg bg-[#0F1115] border border-[#C5A059]/40 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#1A1D24] hover:text-[#D4AF37] disabled:opacity-60 transition shadow-sm"
            >
              {busy ? "Connecting…" : "Send WhatsApp Consultation Inquiry"}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
