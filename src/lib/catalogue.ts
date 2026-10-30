export const fleet = [
  {
    slug: "toyota-land-cruiser",
    name: "Toyota Land Cruiser",
    category: "Premium SUV",
    seats: 7,
    dailyRate: 180000,
    deposit: 300000,
    image:
      "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=85",
    description:
      "Room to explore. A capable seven-seat SUV for family trips, business travel, and the open road.",
  },
  {
    slug: "mercedes-benz-c-class",
    name: "Mercedes-Benz C-Class",
    category: "Luxury sedan",
    seats: 5,
    dailyRate: 140000,
    deposit: 250000,
    image:
      "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1000&q=85",
    description:
      "A composed, comfortable drive for the moments that deserve something special.",
  },
  {
    slug: "toyota-rav4",
    name: "Toyota RAV4",
    category: "Compact SUV",
    seats: 5,
    dailyRate: 95000,
    deposit: 150000,
    image:
      "https://images.unsplash.com/photo-1568844293986-8d0400bd4745?auto=format&fit=crop&w=1000&q=85",
    description:
      "An easy everyday companion with versatile space for city journeys and weekend escapes.",
  },
  {
    slug: "toyota-camry",
    name: "Toyota Camry",
    category: "Sedan",
    seats: 5,
    dailyRate: 75000,
    deposit: 150000,
    image:
      "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1000&q=85",
    description:
      "Comfortable, practical, and ready for your next journey through Ghana.",
  },
];
export function money(amount: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount / 100);
}
