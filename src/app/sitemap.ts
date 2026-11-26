import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/seo";
// Public pages and every car on offer. Rebuilt at most hourly.
export const revalidate = 3600;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl().origin;
  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/fleet`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/how-it-works`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/policies`, changeFrequency: "monthly", priority: 0.4 },
  ];
  const cars = await db.vehicle
    .findMany({ where: { status: "AVAILABLE" }, select: { slug: true } })
    .catch(() => []);
  return [
    ...pages,
    ...cars.map((c) => ({
      url: `${base}/fleet/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
