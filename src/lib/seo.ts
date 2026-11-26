import type { Metadata } from "next";

// The public address, for canonical links, the sitemap and link previews.
export function siteUrl() {
  return new URL(process.env.BETTER_AUTH_URL || "https://anlimacarrental.com");
}

const PREVIEW_IMAGE =
  "/images/figma/home-imgEnhanceThisImage2K20261006134800Photoroom1.png";
// A page's openGraph replaces the layout's, so every page carries these.
export const OPEN_GRAPH = {
  type: "website",
  siteName: "ANLIMA Car Rental",
  locale: "en_GH",
} as const;

// A page search engines should list: its own title, description, canonical
// address and link preview (WhatsApp, Facebook and similar). Link previews
// cannot show SVG, so those fall back to the site photo.
export function publicPage(
  title: string | undefined,
  description: string,
  path: string,
  image?: string,
): Metadata {
  const preview = image && !image.endsWith(".svg") ? image : PREVIEW_IMAGE;
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: {
      ...OPEN_GRAPH,
      ...(title ? { title } : {}),
      description,
      url: path,
      images: [{ url: preview, alt: title ?? "ANLIMA Car Rental" }],
    },
  };
}

// Account, booking, sign-in and staff pages stay out of search results.
export const privatePage = (title?: string): Metadata => ({
  ...(title ? { title } : {}),
  robots: { index: false, follow: false },
});
