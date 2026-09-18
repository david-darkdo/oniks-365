import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

import { fetchAppSettings } from "@/lib/settings";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async () => {
    try {
      const settings = await fetchAppSettings();
      return { settings };
    } catch {
      return { settings: null };
    }
  },
  head: ({ loaderData }) => {
    const settings = loaderData?.settings;
    const googleVerify = settings?.google_site_verification;
    const bingVerify = settings?.bing_site_verification;

    const meta = [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0B0C0E" },
      { title: "ONIKS365 — Premium Kitchen Solutions & Luxury Bathroom Fittings" },
      {
        name: "description",
        content: "ONIKS 365 LUXURY KITCHEN AND BATHROOMS FITTINGS — supplying premium modern kitchen solutions and luxury bathroom fittings across Nigeria.",
      },
      { property: "og:title", content: "ONIKS365 — Premium Kitchen Solutions & Luxury Bathroom Fittings" },
      {
        property: "og:description",
        content: "Oniks365 is a trusted supplier of premium modern kitchen solutions and luxury bathroom fittings delivering quality, elegance, and functionality across Nigeria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "ONIKS365 — Premium Kitchen Solutions & Luxury Bathroom Fittings" },
      { name: "twitter:description", content: "Oniks365 is a trusted supplier of premium modern kitchen solutions and luxury bathroom fittings delivering quality, elegance, and functionality across Nigeria." },
      { property: "og:image", content: "https://oniks365.ng/oniks365-logo.png?v=3" },
      { name: "twitter:image", content: "https://oniks365.ng/oniks365-logo.png?v=3" },
    ];

    if (googleVerify) {
      meta.push({ name: "google-site-verification", content: googleVerify });
    }
    if (bingVerify) {
      meta.push({ name: "msvalidate.01", content: bingVerify });
    }

    return {
      meta,
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "manifest", href: "/manifest.webmanifest?v=3" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=3" },
        { rel: "icon", href: "/favicon.png?v=3", type: "image/png" },
        { rel: "shortcut icon", href: "/favicon.ico?v=3" },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "ONIKS365",
    "legalName": "ONIKS 365 LUXURY KITCHEN AND BATHROOMS FITTINGS",
    "url": "https://oniks365.ng",
    "logo": "https://oniks365.ng/oniks365-logo.png?v=3",
    "description": "ONIKS 365 LUXURY KITCHEN AND BATHROOMS FITTINGS — supplying premium modern kitchen solutions and luxury bathroom fittings across Nigeria.",
    "address": [
      {
        "@type": "PostalAddress",
        "streetAddress": "69/243 Cornershop International Building Materials Market, Dei-Dei",
        "addressLocality": "Abuja FCT",
        "addressCountry": "NG"
      },
      {
        "@type": "PostalAddress",
        "streetAddress": "Odunade Building Materials Market, Coker, Orile, Badagry Expressway",
        "addressLocality": "Lagos",
        "addressCountry": "NG"
      }
    ]
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "ONIKS365 Digital Showroom",
    "url": "https://oniks365.ng",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://oniks365.ng/search?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootAppWrapper />
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootAppWrapper() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPending = useRouterState({ select: (s) => s.status === "pending" });
  const [showLoader, setShowLoader] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    setInitialLoading(false);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPending) {
      timer = setTimeout(() => setShowLoader(true), 150);
    } else {
      setShowLoader(false);
    }
    return () => clearTimeout(timer);
  }, [isPending]);

  useEffect(() => {
    if (!user?.id) return;

    // Track page views
    const trackView = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_id", user.id)
        .maybeSingle();
      if (!profile?.id) return;

      await supabase.from("customer_activity").insert({
        user_id: profile.id,
        activity_type: pathname === "/" ? "homepage_viewed" : "page_viewed",
        metadata: { path: pathname, timestamp: new Date().toISOString() }
      });
    };
    void trackView();

    // Register active PWA mock push device token for testing notifications
    const registerDevice = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_id", user.id)
        .maybeSingle();
      if (!profile?.id) return;

      const mockToken = `web_pwa_token_${user.id.substring(0, 8)}_${navigator.userAgent.replace(/[^a-zA-Z0-9]/g, "").substring(0, 16)}`;
      await supabase.from("communication_devices").upsert({
        user_id: profile.id,
        token: mockToken,
        device_type: "web_pwa",
        os_version: navigator.platform,
        browser: navigator.userAgent.includes("Chrome") ? "Chrome" : "Safari",
        is_active: true,
        updated_at: new Date().toISOString()
      }, { onConflict: "token" });
    };
    void registerDevice();
  }, [user?.id, pathname]);

  const loaderData = Route.useLoaderData();
  const settings = loaderData?.settings;
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": (settings as any)?.company_name || "ONIKS365",
    "url": typeof window !== "undefined" ? window.location.origin : "https://oniks365.ng",
    "logo": (settings as any)?.company_logo || (typeof window !== "undefined" ? `${window.location.origin}/oniks365-logo.png?v=3` : "https://oniks365.ng/oniks365-logo.png?v=3"),
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": settings?.support_whatsapp || "",
      "contactType": "sales & customer support"
    }
  };

  return (
    <div className="relative min-h-screen bg-background">
      <script 
        type="application/ld+json" 
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} 
      />
      {/* Full Page Breathing Logo Loading Screen */}
      {(() => {
        const isApiRoute = pathname === "/robots.txt" || pathname === "/sitemap.xml" || pathname.startsWith("/api/");
        const showGlobalLoader = (showLoader || initialLoading) && !isApiRoute;
        if (!showGlobalLoader) return null;
        return (
          <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/30 backdrop-blur-[1px] transition-all duration-300 animate-fade-in">
            <style>{`
              @keyframes breathing {
                0%, 100% { transform: scale(0.95); opacity: 0.35; }
                50% { transform: scale(1.05); opacity: 0.7; }
              }
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              .animate-breathing {
                animation: breathing 2s ease-in-out infinite;
              }
              .animate-fade-in {
                animation: fadeIn 0.2s ease-out forwards;
              }
            `}</style>
            <div className="flex flex-col items-center gap-4 animate-breathing">
              <img
                src="/oniks365-logo.png?v=3"
                alt="ONIKS365 Logo"
                className="h-16 w-auto object-contain"
              />
              <p className="font-display text-[9px] tracking-widest text-muted-foreground/80 uppercase">
                Loading
              </p>
            </div>
          </div>
        );
      })()}

      <Outlet />
    </div>
  );
}
