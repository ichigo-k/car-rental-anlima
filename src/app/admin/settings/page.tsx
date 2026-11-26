import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { getFees } from "@/lib/fees";
import { FeeSettingsForm } from "@/components/fee-settings-form";
export const dynamic = "force-dynamic";
export default async function Settings() {
  const current = await requireStaff();
  if (!can(current.user.role, "settings.manage"))
    return <p>Administrator access required.</p>;
  const [fees, saved] = await Promise.all([
    getFees(db),
    db.feeSettings.findUnique({ where: { id: "default" } }),
  ]);
  return (
    <>
      <div className="admin-top">
        <div>
          <p className="eyebrow">SETTINGS</p>
          <h1>Fees and charges</h1>
          <p>
            These amounts are used to propose charges when a car is returned and
            to work out cancellation refunds. Staff still approve or waive every
            charge. Changes apply to new charges only.
          </p>
        </div>
      </div>
      {!saved && (
        <p className="admin-callout">
          No fee schedule has been saved yet. Until you save one, only late
          returns are charged (one daily rate per day after a 60-minute grace
          period) and cancellations are free up to 48 hours before pickup.
        </p>
      )}
      <section className="admin-panel">
        <FeeSettingsForm fees={fees} />
        {saved && (
          <p className="muted">
            Last changed{" "}
            {saved.updatedAt.toLocaleString("en-GB", {
              timeZone: "Africa/Accra",
              dateStyle: "medium",
              timeStyle: "short",
            })}
            . Every change is listed in the activity history.
          </p>
        )}
      </section>
    </>
  );
}
