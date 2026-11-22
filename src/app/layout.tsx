import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import "./booking.css";
import "./experience.css";
import "./figma.css";
import "./admin.css";
import "./anlima.css";
import "./marketing-pages.css";
import "./polish.css";
import { FavouritesProvider } from "@/components/favourites";
import { BookingTour } from "@/components/booking-tour";
import { ChatWidget } from "@/components/chat-widget";
import { OPEN_GRAPH, siteUrl } from "@/lib/seo";
import { Analytics } from "@/components/analytics";
import { LiveChat } from "@/components/live-chat";
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: "ANLIMA | Drive with Confidence", template: "%s | ANLIMA" },
  description:
    "Find your next drive with ANLIMA Car Rental. Explore our fleet and reserve your vehicle in Accra, Ghana.",
  openGraph: {
    ...OPEN_GRAPH,
    images: [
      {
        url: "/images/figma/home-imgEnhanceThisImage2K20261006134800Photoroom1.png",
        alt: "ANLIMA Car Rental",
      },
    ],
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={poppins.className}>
        <FavouritesProvider>{children}</FavouritesProvider>
        <BookingTour />
        <ChatWidget enabled={!!process.env.ANTHROPIC_API_KEY} />
        <Analytics />
        <LiveChat
          propertyId={process.env.TAWK_PROPERTY_ID}
          widgetId={process.env.TAWK_WIDGET_ID}
        />
      </body>
    </html>
  );
}
