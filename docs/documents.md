# Customer documents

Customers upload both sides of their driving licence and Ghana Card at **My documents** (`/account/documents`); Guide §5, "approved document upload". Rules are in `src/lib/documents.ts`.

## For customers

- Photos (resized on the phone first, which also removes location data) or PDFs up to 8 MB. The type is checked from the file's content.
- One current copy of each side: uploading again replaces it, and the old file is deleted at once.
- Customers can view or delete their documents at any time. Their bookings page reminds them before pickup if anything is missing, incomplete or not accepted.
- Self-drive bookings need both sides of the licence and Ghana Card before paying. The booking form's Driver step has the uploads, and the server refuses the reservation, and payment, without them (`documentsReady`). Uploads awaiting review count; a rejected side must be replaced. Bookings with an ANLIMA driver do not need them.
- Staff approve the documents before handover and still check the originals at pickup.

## For staff

- **Customers** (`/admin/customers`) shows each customer's licence and Ghana Card status, with a filter for documents awaiting review. Each booking card shows the same status, linked to the customer.
- Staff who can see customers can open documents; every view is recorded in the activity history.
- Agents, managers and administrators approve or reject them. A rejection needs a reason, which is emailed to the customer with a link to upload again.

## Storage and retention

- Files are encrypted with AES-256-GCM before they are written, under `UPLOAD_DIR/documents`. The key is derived from `IDENTITY_ENCRYPTION_SECRET`, or from `BETTER_AUTH_SECRET` if that is not set.
- **Keep that secret safe and unchanged.** Without it the files, including those in backups, cannot be opened; changing it makes existing documents unreadable.
- Rejected documents are deleted 30 days after the decision by the scheduled job.
- The website has no account deletion. If an account is ever removed directly in the database, its document records go with it, but the encrypted files stay in `UPLOAD_DIR/documents` and must be deleted by hand.
