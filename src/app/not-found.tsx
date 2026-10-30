import Link from "next/link";
import { PageState } from "@/components/page-state";
export default function NotFound() {
  return (
    <PageState
      label="404 · PAGE NOT FOUND"
      title="That page isn’t here."
      description="We couldn’t find this page. The link may have changed, or this car may no longer be listed."
    >
      <Link className="button" href="/fleet">
        Find your next car <span aria-hidden="true">→</span>
      </Link>
      <Link className="button secondary" href="/bookings">
        My reservations
      </Link>
    </PageState>
  );
}
