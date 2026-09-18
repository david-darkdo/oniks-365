export function getProductionOrigin(request?: Request): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  if (process.env.SITE_URL) {
    return process.env.SITE_URL.replace(/\/$/, "");
  }

  // Canonical production identity for ONIKS 365
  return "https://oniks365.ng";
}
