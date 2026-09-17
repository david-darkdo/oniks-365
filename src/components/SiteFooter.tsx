import { Link } from "@tanstack/react-router";
import { useAppSettings } from "@/lib/settings";
import { Mail, MapPin, Phone } from "lucide-react";

function FacebookBrandIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramBrandIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function TikTokBrandIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201-1.743 2.895 2.895 0 0 1 2.312-2.834V7.633a6.347 6.347 0 0 0-5.115 6.223A6.34 6.34 0 0 0 10.709 20V9.378a8.16 8.16 0 0 0 4.772 1.524v-3.4a4.847 4.847 0 0 1-1.554-.816z"
        fill="#25F4EE"
        transform="translate(-0.8, -0.6)"
      />
      <path
        d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201-1.743 2.895 2.895 0 0 1 2.312-2.834V7.633a6.347 6.347 0 0 0-5.115 6.223A6.34 6.34 0 0 0 10.709 20V9.378a8.16 8.16 0 0 0 4.772 1.524v-3.4a4.847 4.847 0 0 1-1.554-.816z"
        fill="#FE2C55"
        transform="translate(0.8, 0.6)"
      />
      <path
        d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201-1.743 2.895 2.895 0 0 1 2.312-2.834V7.633a6.347 6.347 0 0 0-5.115 6.223A6.34 6.34 0 0 0 10.709 20V9.378a8.16 8.16 0 0 0 4.772 1.524v-3.4a4.847 4.847 0 0 1-1.554-.816z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

function YouTubeBrandIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

export function SiteFooter() {
  const { data: s } = useAppSettings();

  return (
    <footer className="mt-6 border-t border-[#C5A059]/30 bg-[#0B0C0E] text-gray-300">
      <div className="container-app grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="ONIKS365 Logo" className="h-10 w-auto object-contain" />
            <div className="font-display text-xl font-bold tracking-tight text-[#ea580c]">
              ONIKS365
            </div>
          </div>
          <p className="text-xs font-semibold text-gray-200">
            ONIKS 365 LUXURY KITCHEN AND BATHROOMS FITTINGS
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Oniks365 is a proudly Nigerian, CAC-registered company delivering premium modern kitchen solutions and luxury bathroom fittings across Nigeria.
          </p>
          <p className="text-[11px] font-medium text-[#D4AF37]">
            ONIKS365 – Redefining Comfort, Style, and Functionality.
          </p>
        </div>

        <div>
          <Link to="/" className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] hover:text-[#ea580c] transition block">Showroom Discovery</Link>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link to="/" className="text-gray-400 hover:text-[#D4AF37] transition font-semibold text-[#D4AF37]/90">Storefront Feed</Link></li>
            <li><Link to="/" className="text-gray-400 hover:text-[#D4AF37] transition">Kitchen & Bathroom Catalog</Link></li>
            <li><Link to="/home" className="text-gray-400 hover:text-[#D4AF37] transition">Showroom Home</Link></li>
            <li><Link to="/collection" className="text-gray-400 hover:text-[#D4AF37] transition">Project Collection Workspace</Link></li>
            <li><Link to="/contact" className="text-gray-400 hover:text-[#D4AF37] transition">Contact & Showrooms</Link></li>
          </ul>
        </div>

        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">Locations & Delivery</div>
          <ul className="mt-4 space-y-3 text-xs text-gray-400">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-[#D4AF37] shrink-0" />
              {s?.map_url ? (
                <a
                  href={s.map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open location in Google Maps"
                  className="group hover:text-[#D4AF37] transition cursor-pointer"
                >
                  <strong className="block text-gray-200 font-semibold group-hover:text-[#D4AF37] transition">Abuja Showroom:</strong>
                  <span>{s.company_address || "69/243 Cornershop International Building Materials Market, Dei-Dei, Abuja FCT, Nigeria"}</span>
                </a>
              ) : (
                <div>
                  <strong className="block text-gray-200 font-semibold">Abuja Showroom:</strong>
                  <span>{s?.company_address || "69/243 Cornershop International Building Materials Market, Dei-Dei, Abuja FCT, Nigeria"}</span>
                </div>
              )}
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-[#D4AF37] shrink-0" />
              {s?.map_url ? (
                <a
                  href={s.map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open location in Google Maps"
                  className="group hover:text-[#D4AF37] transition cursor-pointer"
                >
                  <strong className="block text-gray-200 font-semibold group-hover:text-[#D4AF37] transition">Lagos Office:</strong>
                  <span>Odunade Building Materials Market, Coker, Orile, Badagry Expressway, Lagos, Nigeria</span>
                </a>
              ) : (
                <div>
                  <strong className="block text-gray-200 font-semibold">Lagos Office:</strong>
                  <span>Odunade Building Materials Market, Coker, Orile, Badagry Expressway, Lagos, Nigeria</span>
                </div>
              )}
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-[#D4AF37] shrink-0" />
              <span>Nationwide Delivery across Nigeria (Payment on delivery in Abuja & Lagos)</span>
            </li>
            {s?.company_email && (
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#D4AF37] shrink-0" />
                <a href={`mailto:${s.company_email}`} className="hover:text-[#D4AF37]">{s.company_email}</a>
              </li>
            )}
          </ul>
        </div>

        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">Connect & Inquiries</div>
          <p className="mt-4 text-xs text-gray-400 leading-relaxed">
            Upgrading or furnishing your kitchen or bathroom? Speak directly with our consultation team via WhatsApp.
          </p>
          <div className="mt-4">
            <a
              href={`https://wa.me/${(s?.sales_whatsapp || "2348035186355").replace(/[^\d]/g, "")}?text=${encodeURIComponent("Hello ONIKS365, I would like to inquire about your kitchen and bathroom solutions.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-[#1EBE5D]"
            >
              <Phone className="h-4 w-4" />
              <span>WhatsApp Consultation</span>
            </a>
          </div>
          
          <ul className="mt-6 flex flex-wrap items-center gap-3">
            <li>
              <a
                href={s?.facebook_url || "https://facebook.com"}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="grid h-10 w-10 place-items-center rounded-full bg-[#1877F2] text-white shadow-md transition-all hover:scale-110"
              >
                <FacebookBrandIcon className="h-5 w-5 fill-white" />
              </a>
            </li>
            <li>
              <a
                href={s?.instagram_url || "https://instagram.com"}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-tr from-[#fdf497] via-[#fd5949] to-[#d6249f] text-white shadow-md transition-all hover:scale-110"
              >
                <InstagramBrandIcon className="h-5 w-5 fill-white" />
              </a>
            </li>
            <li>
              <a
                href={s?.tiktok_url || "https://tiktok.com"}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
                className="grid h-10 w-10 place-items-center rounded-full bg-black text-white shadow-md ring-1 ring-white/20 transition-all hover:scale-110"
              >
                <TikTokBrandIcon className="h-5 w-5 fill-white" />
              </a>
            </li>
            <li>
              <a
                href={(s as any)?.youtube_url || "https://youtube.com"}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                className="grid h-10 w-10 place-items-center rounded-full bg-[#FF0000] text-white shadow-md transition-all hover:scale-110"
              >
                <YouTubeBrandIcon className="h-5 w-5 fill-white" />
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-4 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} ONIKS365 — ONIKS 365 LUXURY KITCHEN AND BATHROOMS FITTINGS. All rights reserved.
      </div>
    </footer>
  );
}
