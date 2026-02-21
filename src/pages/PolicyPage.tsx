import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageSeo } from "@/lib/usePageSeo";
import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

type PolicyDoc = {
  title: string;
  updatedOn: string;
  sections: Array<{ heading: string; body: string }>;
};

const POLICY_DOCS: Record<string, PolicyDoc> = {
  "user-agreement": {
    title: "User Agreement",
    updatedOn: "February 16, 2026",
    sections: [
      {
        heading: "Acceptable Use",
        body: "Users must operate EazziHotech for legitimate hospitality operations and must not misuse the platform for unauthorized access, spam, or fraudulent activity.",
      },
      {
        heading: "Workspace Responsibility",
        body: "Tenant admins are responsible for user provisioning, role assignments, and ensuring staff actions align with internal policy and local regulation.",
      },
      {
        heading: "Service Access and Suspension",
        body: "Workspace access may be limited based on subscription status. Suspended subscriptions may block login until reactivated by Platform Super Admin.",
      },
    ],
  },
  cookies: {
    title: "Cookies Policy",
    updatedOn: "February 16, 2026",
    sections: [
      {
        heading: "Essential Cookies",
        body: "EazziHotech uses essential browser storage and session mechanisms to keep users authenticated, maintain tenant context, and protect account sessions.",
      },
      {
        heading: "Security Purpose",
        body: "Cookie/session usage supports secure API access, role-based controls, and prevention of unauthorized requests across protected operations.",
      },
      {
        heading: "User Controls",
        body: "Disabling essential cookies or storage may prevent login and secure app functionality. Use browser controls carefully in production workspaces.",
      },
    ],
  },
  faqs: {
    title: "Frequently Asked Questions",
    updatedOn: "February 16, 2026",
    sections: [
      {
        heading: "Can I manage multiple properties and units?",
        body: "Yes. Each tenant workspace supports multiple properties and units, depending on plan limits and settings.",
      },
      {
        heading: "Who can change subscription status?",
        body: "Only Platform Super Admin can update subscription status for tenant workspaces.",
      },
      {
        heading: "Are guest notifications supported?",
        body: "Yes. Guest email notifications are available for booking confirmation, check-in completion, and check-out completion.",
      },
      {
        heading: "What are support hours?",
        body: "Business open hours are Monday to Friday, 8:00am to 5:00pm, with 24-hour support coverage for operational assistance.",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updatedOn: "February 16, 2026",
    sections: [
      {
        heading: "Data We Process",
        body: "We process tenant account data, property and booking records, payment records, and user profile data needed to operate the platform.",
      },
      {
        heading: "Tenant Data Isolation",
        body: "Each tenant workspace is logically isolated. Access is scoped by tenant context and role-based authorization controls.",
      },
      {
        heading: "Retention",
        body: "Operational records are retained for business continuity, support, and compliance requirements, based on contractual obligations.",
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    updatedOn: "February 16, 2026",
    sections: [
      {
        heading: "Service Scope",
        body: "EazziHotech provides software for managing hospitality operations. Features may evolve based on roadmap and service plans.",
      },
      {
        heading: "Account Responsibilities",
        body: "Tenants are responsible for credential security, user provisioning, and data entered by their teams into the platform.",
      },
      {
        heading: "Billing and Suspension",
        body: "Subscription status controls platform access. Suspended tenants may be blocked from login until service is reactivated.",
      },
    ],
  },
  security: {
    title: "Security Policy",
    updatedOn: "February 16, 2026",
    sections: [
      {
        heading: "Access Controls",
        body: "Authentication is required for protected routes and APIs. Authorization is enforced by role and tenant boundaries.",
      },
      {
        heading: "Audit and Monitoring",
        body: "Critical operations such as user changes, payment actions, and subscription updates are monitored for traceability.",
      },
      {
        heading: "Incident Handling",
        body: "Security events are triaged by severity. Affected tenants are informed according to response procedures.",
      },
    ],
  },
  support: {
    title: "Support Policy",
    updatedOn: "February 16, 2026",
    sections: [
      {
        heading: "Support Channels",
        body: "Support is available through web contact forms and approved communication channels for onboarding, billing, and technical issues.",
      },
      {
        heading: "Response Windows",
        body: "Incidents are prioritized by impact. Higher-severity operational blockers are handled on an expedited basis.",
      },
      {
        heading: "Escalation",
        body: "Unresolved issues can be escalated to platform operations with issue context, affected tenant, and reproduction details.",
      },
    ],
  },
};

export default function PolicyPage() {
  const nav = useNavigate();
  const { policyId } = useParams();

  const doc = useMemo(() => {
    if (!policyId) return null;
    return POLICY_DOCS[policyId] || null;
  }, [policyId]);

  usePageSeo({
    title: doc ? `${doc.title} | EazziHotech` : "Policy Not Found | EazziHotech",
    description: doc
      ? `${doc.title} for EazziHotech platform usage, privacy, security, and support operations.`
      : "Requested policy page is not available.",
    canonicalPath: policyId ? `/policies/${policyId}` : "/policies",
    type: "article",
    noindex: !doc,
  });

  if (!doc) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-3xl space-y-4">
          <h1 className="text-3xl font-bold">Policy Not Found</h1>
          <p className="text-slate-600">The policy page you requested does not exist.</p>
          <Button onClick={() => nav("/")}>Back to Landing</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">{doc.title}</h1>
            <p className="mt-1 text-sm text-slate-500">Last updated: {doc.updatedOn}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/">Back to Landing</Link>
            </Button>
            <Button onClick={() => nav("/login")}>Go to Login</Button>
          </div>
        </div>

        <div className="grid gap-4">
          {doc.sections.map((section) => (
            <Card key={section.heading}>
              <CardHeader>
                <CardTitle className="text-xl">{section.heading}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700">{section.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
