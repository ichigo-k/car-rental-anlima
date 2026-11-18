# Anlima marketing screens

Implemented from the Anlima Figma file `mHTNFXLRAUVMZ3jnvODMXw`, Page 1:

- `/`: Homepage, node `1:2`, including the “Rent a Car in 3 Easy Steps” band (node `377:105`).
- `/fleet`: Cars, node `191:22`, including Featured Cars (`279:43`), the “Right Car for Every Journey” banner (`288:428`) and customer testimonials (`339:84`).
- `/about`: About Us, node `400:550`.
- `/contact`: Contact Us, node `436:513`.
- `/how-it-works`: rental guide, node `341:171`.

Photography, icons and illustrations are local assets in `public/images/figma`.
The About Us car-and-driver illustration is exported directly from node `436:335` as SVG.
Shared page elements live in `src/components/anlima-pages.tsx`; page styling is scoped in `src/app/marketing-pages.css`.

The Contact Us business details intentionally retain Figma placeholders at the owner's request.
The enquiry-type field corrects a duplicated “Phone Number” label in the design; the vision card is labelled “Our Vision”.
Booking instructions reflect the application's existing 15-minute payment hold.

Contact submissions are validated server-side and stored in `ContactEnquiry`. They are available at `/admin/enquiries` to ADMIN, MANAGER and AGENT roles. No email is sent automatically.
Apply the additive migration with `npm run db:migrate` and regenerate Prisma with `npm run db:generate` when deploying.
Run `npm run test:contact` against a running local app to check validation, origin checks, concurrent per-email limits, durable storage and inbox protection. The script removes only its own synthetic messages.

The main navigation follows Figma node `33:6`: Home, Cars, How It Works, About Us and Contact, plus Book a Car. Saved cars and account links are not in the Figma navigation; they appear in the mobile menu and the footer. About Us and Contact open dedicated pages.

Featured Cars shows the four oldest available vehicles from the database rather than the fixed Figma photographs. Detailed vehicle cards show the daily rate on the photo badge and the vehicle deposit as the Figma “Down Payment”.
Loose frames elsewhere on the Figma canvas are working drafts of these five pages and are not separate screens.
