import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";
// Account, booking, staff and API addresses stay out of search engines; the
// pages themselves are also marked noindex.
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl().origin;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/account/",
        "/auth/",
        "/bookings",
        "/favourites",
        "/staff-security",
        "/reset-password",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
