import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import "./booking.css";
import "./experience.css";
import "./figma.css";
import "./admin.css";
import "./anlima.css";
import "./marketing-pages.css";
import { FavouritesProvider } from "@/components/favourites";
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
export const metadata: Metadata = {
  title: { default: "ANLIMA | Drive with Confidence", template: "%s | ANLIMA" },
  description:
    "Find your next drive with ANLIMA Car Rental. Explore our fleet and reserve your vehicle in Accra, Ghana.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={poppins.className}>
        <FavouritesProvider>{children}</FavouritesProvider>
      </body>
    </html>
  );
}
