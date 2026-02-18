type ManualSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  steps?: string[];
};

const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: "purpose",
    title: "1. Purpose",
    paragraphs: [
      "EazziHotech is a multi-tenant hotel and short-let operations platform designed for complete daily operations control within a secure tenant workspace.",
      "The platform supports end-to-end workflows: guest onboarding, property and unit inventory, booking lifecycle, payment tracking, check-in and check-out verification, damages and overstay handling, refunds, and reporting.",
      "This manual is intended for super admins, tenant admins, managers, and front-desk teams who need consistent operational procedures for production usage.",
    ],
  },
  {
    id: "user-roles",
    title: "2. User Roles",
    paragraphs: [
      "Access in EazziHotech is role-based. Each role is intentionally scoped to reduce operational risk and maintain governance across tenant workspaces.",
    ],
    bullets: [
      "Platform Super Admin: Cross-tenant controls, tenant creation, subscription governance, platform-level visibility, and leads.",
      "Tenant Admin: Full tenant workspace operations including settings, user management, property workflows, and approvals.",
      "Manager: Operational control of bookings, guests, check-in/out, payments, and reports with stricter configuration boundaries.",
      "Staff: Front desk operations focused on execution workflows with restricted access to sensitive controls.",
      "Permission rule: Lower-privilege roles cannot manage or escalate higher-privilege users.",
    ],
  },
  {
    id: "login-authentication",
    title: "3. Login and Authentication",
    paragraphs: [
      "Every user signs in to a tenant workspace. This workspace context controls accessible records, actions, and API scope.",
    ],
    steps: [
      "Open Login page.",
      "Select workspace (tenant).",
      "Enter email and password.",
      "Click Sign in.",
    ],
    bullets: [
      "Password reset: Use Forgot password, provide workspace (optional but recommended) and email, then complete reset through email link.",
      "Session timeout: Users are automatically logged out after 5 minutes of inactivity.",
      "Security note: Always log out when changing device or shift.",
    ],
  },
  {
    id: "main-navigation",
    title: "4. Main Navigation",
    paragraphs: [
      "Use the sidebar and topbar to move across operational modules. Modules displayed can vary by role.",
    ],
    bullets: [
      "Dashboard",
      "Properties",
      "Guests",
      "Bookings",
      "Payments",
      "Check In",
      "Check Out",
      "Reports",
      "Settings",
      "Users Management",
      "Leads (Super Admin only)",
    ],
  },
  {
    id: "dashboard",
    title: "5. Dashboard",
    paragraphs: [
      "Dashboard is your operational command view. It provides role-aware summaries so teams can identify what needs attention first.",
    ],
    bullets: [
      "Role-based summary cards",
      "Booking and payment visibility",
      "Quick links to key workflows",
      "Workspace usage overview",
    ],
  },
  {
    id: "properties-units",
    title: "6. Properties and Units",
    paragraphs: [
      "Properties and units are the foundation of room availability, occupancy, and revenue calculations.",
    ],
    steps: [
      "Create Property: Properties -> Create New Property -> fill details -> Save.",
      "Add Unit: Open property -> Add Unit -> fill unit details -> Save.",
    ],
    bullets: [
      "Property indicators include unit count, occupancy, and monthly revenue.",
      "Always confirm unit capacity, base price, and active status before accepting bookings.",
    ],
  },
  {
    id: "guests",
    title: "7. Guests",
    paragraphs: [
      "Guest master records should be kept clean and complete. Booking, check-in, and checkout workflows reuse this profile for consistency.",
    ],
    steps: [
      "Guests -> Create Guest.",
      "Enter guest details (name, contacts, nationality/address, ID information).",
      "Save guest.",
    ],
    bullets: [
      "Search by name, email, phone, or ID and open full profile details.",
      "Maintain complete ID details to reduce check-in delays and verification issues.",
    ],
  },
  {
    id: "bookings",
    title: "8. Bookings",
    paragraphs: [
      "Bookings represent the financial and occupancy commitment for a guest stay. Validation rules prevent overlap and inconsistent statuses.",
    ],
    steps: [
      "Bookings -> New Booking.",
      "Select property/unit and check-in/check-out dates.",
      "Select existing guest or create inline.",
      "Confirm amount and save booking.",
    ],
    bullets: [
      "Date availability checks follow Africa/Lagos timezone day logic.",
      "Record payment directly from booking for UNPAID/PARTPAID records.",
      "Use accurate check-in/check-out times and amount values for clean reporting.",
    ],
  },
  {
    id: "payments",
    title: "9. Payments",
    paragraphs: [
      "Payments module tracks what has been paid and what is still due per booking, with clear status transitions.",
    ],
    bullets: [
      "Pending tab tracks balances due.",
      "Confirmed tab tracks confirmed payment records.",
      "Use search and booking filters for reconciliation.",
      "Ensure payment references are entered correctly for audit traceability.",
    ],
  },
  {
    id: "check-in",
    title: "10. Check In",
    paragraphs: [
      "Check-in validates booking readiness, guest identity information, and required payment/deposit logic before occupancy starts.",
    ],
    steps: [
      "Open Check In and select booking from arrivals.",
      "Validate guest/ID details.",
      "Optionally tick Also update Guest profile.",
      "Confirm check-in.",
    ],
    bullets: [
      "Guest photo supports both Take Photo (camera/webcam) and Select from Gallery/File.",
      "Mobile devices may offer camera capture directly from file chooser.",
      "Use 'Also update Guest profile' when current stay details should sync back to guest master.",
    ],
  },
  {
    id: "check-out",
    title: "11. Check Out",
    paragraphs: [
      "Checkout finalizes settlement and closes occupancy. The certification modal is the final control point for operational and financial completeness.",
    ],
    steps: [
      "Open Check Out and search/select in-house guest.",
      "Open checkout certification modal.",
      "Review outstanding amount, damages, overstay, refund policy.",
      "Confirm checkout after settlement.",
    ],
    bullets: [
      "Checkout is blocked when balance remains unsettled.",
      "Damages and overstay charges can be added and reflected in outstanding balance.",
      "Early checkout supports refund policy capture and reporting.",
      "Verify guest photo, stay dates, and settlement values before final confirmation.",
    ],
  },
  {
    id: "reports",
    title: "12. Reports",
    paragraphs: [
      "Reports aggregate operational and financial performance for leadership, audits, and periodic reviews.",
    ],
    bullets: [
      "Overview",
      "Revenue",
      "Outstanding",
      "Occupancy",
      "Refunds",
      "Damages",
      "Date-range and property-level filtering",
    ],
  },
  {
    id: "settings",
    title: "13. Settings",
    paragraphs: [
      "Settings centralize workspace profile, platform controls, and governance-related configuration.",
    ],
    bullets: [
      "Workspace profile details",
      "Subscription status visibility",
      "Usage and plan limits",
      "Super Admin tenant controls and tenant creation",
      "Platform Super Admin controls tenant subscription state",
    ],
  },
  {
    id: "users-management",
    title: "14. Users Management",
    paragraphs: [
      "User management should be handled with clear role ownership to maintain security and accountability.",
    ],
    bullets: [
      "Create users",
      "Edit user details",
      "Assign role (subject to permission model)",
      "Enable/disable user (where permitted)",
      "Lower-privileged roles cannot manage higher roles",
    ],
  },
  {
    id: "email-notifications",
    title: "15. Email Notifications",
    paragraphs: [
      "Lifecycle notifications keep guests and tenant admins aligned on booking status progression.",
    ],
    bullets: [
      "Booking confirmation",
      "Check-in confirmation",
      "Check-out confirmation",
      "Recipients: guest and active tenant admin recipients",
      "Requires production email setup (Resend verified domain + correct env values)",
    ],
  },
];

export default function HelpManual() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-4 md:px-6 print:px-0">
      <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm print:border-0 print:shadow-none">
        <p className="text-xs uppercase tracking-wide text-indigo-600">In-App Guide</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">EazziHotech User Manual</h1>
        <p className="mt-2 text-sm text-slate-600">
          Version: v1 · Product URL: <span className="font-medium text-slate-800">https://app.eazzihotech.com</span>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-20 lg:h-fit print:hidden">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Table of Contents</h2>
          <nav className="mt-3 max-h-[65vh] space-y-1 overflow-auto pr-1">
            {MANUAL_SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="block rounded-md px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-indigo-700"
              >
                {section.title}
              </a>
            ))}
          </nav>
        </aside>

        <main className="space-y-4">
          {MANUAL_SECTIONS.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:break-inside-avoid print:border print:shadow-none"
            >
              <h2 className="text-lg font-semibold text-slate-900 md:text-xl">{section.title}</h2>

              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-sm leading-6 text-slate-700 md:text-[15px]">
                  {paragraph}
                </p>
              ))}

              {section.steps?.length ? (
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-700 md:text-[15px]">
                  {section.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              ) : null}

              {section.bullets?.length ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700 md:text-[15px]">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
