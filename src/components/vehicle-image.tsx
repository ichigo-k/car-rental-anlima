// These exact model images are supplied by the Anlima Figma design.
const modelImages: Record<string, string> = {
  "toyota-corolla": "home-imgRectangle6.png",
  "toyota-rav4": "home-imgRectangle7.png",
  "mercedes-benz-c-class": "home-imgRectangle8.png",
  "hyundai-tucson": "home-imgRectangle9.png",
};
export function VehicleImage({
  slug,
  image,
  name,
  className = "",
}: {
  slug: string;
  image: string;
  name: string;
  className?: string;
}) {
  // Preserve administrator-uploaded photography; only replace seed catalogue imagery.
  const source =
    modelImages[slug] && image.startsWith("https://images.unsplash.com/")
      ? `/images/figma/${modelImages[slug]}`
      : image;
  return (
    <div className={`vehicle-image ${className}`}>
      <img src={source} alt={name} loading="lazy" />
    </div>
  );
}
