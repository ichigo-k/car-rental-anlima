# Anlima marketing screens

Implemented from the Anlima Figma file `mHTNFXLRAUVMZ3jnvODMXw`, Page 1:

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

How It Works remains absent from the main navigation to preserve the previous owner preference; it is linked from the footer. About Us and Contact now open dedicated pages.
