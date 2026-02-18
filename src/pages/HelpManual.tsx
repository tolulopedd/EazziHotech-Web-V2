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
      "EazziHotech is a multi-tenant hotel/shortlet operations platform used to manage guests, properties, units, bookings, payments, check-in, check-out, damages, refunds, and reporting from one workspace.",
    ],
  },
  {
    id: "user-roles",
    title: "2. User Roles",
    bullets: [
      "Platform Super Admin: Cross-tenant controls, tenant lifecycle, subscriptions, platform leads.",
      "Tenant Admin: Full workspace operations, settings, and users.",
      "Manager: Day-to-day operations with controlled admin permissions.",
      "Staff: Front desk operations with restricted sensitive controls.",
    ],
  },
  {
    id: "login-authentication",
    title: "3. Login and Authentication",
    steps: [
      "Open Login page.",
      "Select workspace (tenant).",
      "Enter email and password.",
      "Click Sign in.",
    ],
    bullets: [
      "Password reset: Use Forgot password, provide workspace (optional) and email, then complete reset from email link.",
      "Session timeout: Users are automatically logged out after 5 minutes of inactivity.",
    ],
  },
  {
    id: "main-navigation",
    title: "4. Main Navigation",
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
    steps: [
      "Create Property: Properties -> Create New Property -> fill details -> Save.",
      "Add Unit: Open property -> Add Unit -> fill unit details -> Save.",
    ],
    bullets: ["Property indicators include unit count, occupancy, and monthly revenue."],
  },
  {
    id: "guests",
    title: "7. Guests",
    steps: [
      "Guests -> Create Guest.",
      "Enter guest details (name, contacts, nationality/address, ID information).",
      "Save guest.",
    ],
    bullets: ["Search by name, email, phone, or ID and open full profile details."],
  },
  {
    id: "bookings",
    title: "8. Bookings",
    steps: [
      "Bookings -> New Booking.",
      "Select property/unit and check-in/check-out dates.",
      "Select existing guest or create inline.",
      "Confirm amount and save booking.",
    ],
    bullets: [
      "Date availability checks follow Africa/Lagos timezone day logic.",
      "Record payment directly from booking for UNPAID/PARTPAID records.",
    ],
  },
  {
    id: "payments",
    title: "9. Payments",
    bullets: [
      "Pending tab tracks balances due.",
      "Confirmed tab tracks confirmed payment records.",
      "Use search and booking filters for reconciliation.",
    ],
  },
  {
    id: "check-in",
    title: "10. Check In",
    steps: [
      "Open Check In and select booking from arrivals.",
      "Validate guest/ID details.",
      "Optionally tick Also update Guest profile.",
      "Confirm check-in.",
    ],
    bullets: [
      "Guest photo supports both Take Photo (camera/webcam) and Select from Gallery/File.",
      "Mobile devices may offer camera capture directly from file chooser.",
    ],
  },
  {
    id: "check-out",
    title: "11. Check Out",
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
    ],
  },
  {
    id: "reports",
    title: "12. Reports",
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
    bullets: [
      "Create users",
      "Edit user details",
      "Assign role (subject to permission model)",
      "Enable/disable user (where permitted)",
      "Lower-privileged roles cannot manage higher roles",
    ],
  },
  {
    id: "leads",
    title: "15. Leads (Super Admin)",
    paragraphs: [
      "Leads page displays public lead submissions from the landing page for structured sales follow-up.",
    ],
  },
  {
    id: "email-notifications",
    title: "16. Email Notifications",
    bullets: [
      "Booking confirmation",
      "Check-in confirmation",
      "Check-out confirmation",
      "Recipients: guest and active tenant admin recipients",
      "Requires production email setup (Resend verified domain + correct env values)",
    ],
  },
  {
    id: "mobile-notes",
    title: "17. Mobile Experience Notes",
    bullets: [
      "Single-instance mobile sidebar drawer",
      "Scrollable check-in and checkout modals",
      "Camera/file photo options for guest photo capture",
    ],
  },
  {
    id: "troubleshooting",
    title: "18. Troubleshooting",
    bullets: [
      "No workspaces found: verify tenant exists and is active.",
      "Photo upload fails: verify S3 CORS, IAM permissions, backend env, and presign -> upload -> confirm flow.",
      "Photo unavailable at checkout: verify signed photo URL response and object existence.",
      "Password reset email not received: verify Resend domain and EMAIL_FROM value.",
    ],
  },
  {
    id: "day-zero-setup",
    title: "19. Recommended Day-0 Setup Order",
    steps: [
      "Workspace/Tenant setup",
      "Property creation",
      "Unit creation",
      "User creation",
      "Guest seed/import",
      "Booking and payment process test",
      "Check-in/check-out test",
      "Report verification",
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

