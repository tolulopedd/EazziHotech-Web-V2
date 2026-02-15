import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import logo from "@/assets/logo512.png";
import { publicFetch } from "@/lib/api";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDot,
  Clock3,
  Globe,
  MapPin,
  Menu,
  Phone,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const features = [
  "Bookings, check-in and check-out in one flow",
  "Guest profiles, ID records and stay history",
  "Payments, balances, damages and settlement tracking",
  "Role-based access for Admin, Manager and Staff",
];

const policies = [
  {
    title: "User Agreement",
    href: "/policies/user-agreement",
    body: "Rules and responsibilities for tenant admins, managers, and staff using EazziHotech in production.",
  },
  {
    title: "Cookies Policy",
    href: "/policies/cookies",
    body: "How cookies/session storage are used for authentication, security, and essential product functionality.",
  },
  {
    title: "FAQs",
    href: "/policies/faqs",
    body: "Answers to common onboarding, billing, security, and support questions before and after go-live.",
  },
  {
    title: "Privacy & Data Protection",
    href: "/policies/privacy",
    body: "We keep tenant data isolated and enforce strict workspace boundaries. Access is controlled by role and authentication policies.",
  },
];

const faqHighlights = [
  {
    q: "Can we manage multiple properties in one workspace?",
    a: "Yes. One tenant workspace can manage multiple properties and units with role-based access controls.",
  },
  {
    q: "Who can change tenant subscription access?",
    a: "Only platform Super Admin can suspend, restore, or place a tenant in grace status.",
  },
  {
    q: "Do guests get email notifications automatically?",
    a: "Yes. Booking, check-in, and check-out notification emails are supported.",
  },
  {
    q: "What are your support hours?",
    a: "Business open hours are Monday to Friday, 8:00am to 5:00pm, with 24-hour support coverage.",
  },
];

const onboardingSteps = [
  "Contact our sales team.",
  "Get a live product demo.",
  "Receive a tailored proposal.",
  "Pay the setup fee.",
  "Get your workspace setup within 3 days.",
  "Enjoy one month free usage after setup.",
  "Move to subscription billing: Monthly, Quarterly (5% off), or Yearly (10% off).",
];

const companyInfo = {
  name: "MyEazzi Solution Limited",
  address: "5B Block 1, Saphirre Lane, Howston Wright Estate, Oregun, Ikeja, Lagos",
  phone: "+234-905-2222-022",
  websiteLabel: "www.eazzihotech.com",
  websiteHref: "https://www.eazzihotech.com",
  supportEmail: "support@eazzihotech.com",
  businessHours: "8:00am to 5:00pm Monday to Friday",
  supportHours: "24-hour support",
};

const aiUseCases = [
  {
    title: "Sales Concierge",
    body: "Connect with our sales assistant to qualify your use case and route you to the right onboarding flow.",
  },
  {
    title: "Support Assistant",
    body: "24-hour product and policy FAQ assistance with handoff to human support for billing and account issues.",
  },
  {
    title: "Guest Ops Helper",
    body: "Highlights risky bookings, outstanding balances, and likely check-out blockers for front-desk operations.",
  },
];

type RecentTenant = {
  id: string;
  name: string;
  slug: string;
  createdAt?: string;
};

type TenantCard = {
  id: string;
  name: string;
  product: string;
  location: string;
  joined: string;
};

type LeadForm = {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  businessType: string;
  message: string;
  website: string; // honeypot (should remain empty)
};

type LeadErrors = Partial<Record<keyof LeadForm, string>>;

const fallbackTenants: TenantCard[] = [
  {
    id: "founding-dtt",
    name: "DTT Properties Limited",
    product: "DTT Shortlet",
    location: "Lagos, Nigeria",
    joined: "Founding Tenant",
  },
];

function trackEvent(name: string, props?: Record<string, unknown>) {
  const payload = { event: name, ...(props || {}) };
  (window as any).dataLayer?.push(payload);
  (window as any).gtag?.("event", name, props || {});
  console.info("[landing-event]", payload);
}

function validateLeadForm(form: LeadForm): LeadErrors {
  const errors: LeadErrors = {};
  if (!form.companyName.trim()) errors.companyName = "Company name is required.";
  if (!form.contactName.trim()) errors.contactName = "Contact name is required.";
  if (!form.email.trim()) {
    errors.email = "Business email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (form.phone.trim() && form.phone.trim().length < 6) {
    errors.phone = "Phone number seems too short.";
  }
  if (form.message.trim().length > 1000) {
    errors.message = "Message must be 1000 characters or less.";
  }
  return errors;
}

export default function Landing() {
  const nav = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [recentTenants, setRecentTenants] = useState<RecentTenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadErrors, setLeadErrors] = useState<LeadErrors>({});
  const [leadForm, setLeadForm] = useState<LeadForm>({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    businessType: "",
    message: "",
    website: "",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await publicFetch("/api/public/tenants/recent?limit=6");
        if (!cancelled) {
          const rows = Array.isArray(data?.tenants) ? data.tenants : [];
          setRecentTenants(rows);
          trackEvent("landing_recent_tenants_loaded", { count: rows.length });
        }
      } catch {
        if (!cancelled) setRecentTenants([]);
      } finally {
        if (!cancelled) setLoadingTenants(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const tenantCards = useMemo<TenantCard[]>(() => {
    if (recentTenants.length === 0) return fallbackTenants;
    return recentTenants.map((t) => {
      const isDtt = t.name.toLowerCase().includes("dtt properties");
      const d = t.createdAt ? new Date(t.createdAt) : null;
      const joinedDate = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString() : "Recently joined";
      return {
        id: t.id,
        name: t.name,
        product: isDtt ? "DTT Shortlet" : `Workspace: ${t.slug}`,
        location: isDtt ? "Lagos, Nigeria" : "Tenant workspace",
        joined: isDtt ? "Founding Tenant" : `Joined ${joinedDate}`,
      };
    });
  }, [recentTenants]);

  function openWhatsAppAI() {
    trackEvent("landing_ai_whatsapp_click");
    const text = encodeURIComponent(
      "Hello EazziHotech team. I want a product demo and setup support for customer support and sales automation."
    );
    window.open(`https://wa.me/2349052222022?text=${text}`, "_blank", "noopener,noreferrer");
  }

  async function submitLead(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errors = validateLeadForm(leadForm);
    setLeadErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Please correct the highlighted fields.");
      trackEvent("landing_lead_validation_failed", { fields: Object.keys(errors).join(",") });
      return;
    }

    try {
      setLeadSubmitting(true);
      const data = await publicFetch("/api/public/leads", {
        method: "POST",
        body: JSON.stringify({
          companyName: leadForm.companyName.trim(),
          contactName: leadForm.contactName.trim(),
          email: leadForm.email.trim(),
          phone: leadForm.phone.trim() || undefined,
          businessType: leadForm.businessType.trim() || undefined,
          message: leadForm.message.trim() || undefined,
          website: leadForm.website,
        }),
      });
      toast.success(data?.message || "Lead submitted successfully.");
      trackEvent("landing_lead_submit_success");
      setLeadForm({
        companyName: "",
        contactName: "",
        email: "",
        phone: "",
        businessType: "",
        message: "",
        website: "",
      });
      setLeadErrors({});
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit lead. Please try again.");
      trackEvent("landing_lead_submit_failed", { reason: err?.code || "unknown" });
    } finally {
      setLeadSubmitting(false);
    }
  }

  function goToDemoForm() {
    trackEvent("landing_book_demo_click");
    document.getElementById("lead-capture")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileMenuOpen(false);
  }

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  }

  return (
    <div className="min-h-screen overflow-x-hidden text-slate-900" style={{ fontFamily: '"Space Grotesk", "Manrope", sans-serif' }}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(1200px_500px_at_15%_-10%,#fef3c7,transparent),radial-gradient(1000px_450px_at_85%_0%,#dbeafe,transparent),linear-gradient(#ffffff,#f8fafc)]" />

      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/75 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-3xl ring-1 ring-indigo-300 overflow-hidden bg-white">
              <img src={logo} alt="EazziHotech logo" className="h-full w-full object-contain" />
            </div>
            <span className="text-lg font-bold tracking-tight">EazziHotech</span>
            <span className="hidden rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 sm:inline-flex">
              Onboard in 3 days
            </span>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Button variant="ghost" onClick={() => scrollToSection("policies")}>
              Policies
            </Button>
            <Button variant="ghost" onClick={() => scrollToSection("onboarding")}>
              Onboarding
            </Button>
            <Button variant="ghost" onClick={() => scrollToSection("faqs")}>
              FAQs
            </Button>
            <Button variant="ghost" onClick={() => scrollToSection("tenants")}>
              Tenants
            </Button>
            <Button variant="ghost" onClick={() => scrollToSection("company")}>
              Contact
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setMobileMenuOpen(false);
                nav("/login");
              }}
            >
              Login
            </Button>
            <Button onClick={goToDemoForm}>Book Demo</Button>
          </div>
          <Button
            variant="ghost"
            className="h-9 w-9 p-0 md:hidden"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
        {mobileMenuOpen ? (
          <div className="border-t border-slate-200 bg-white md:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3">
              <Button variant="ghost" className="justify-start" onClick={() => scrollToSection("policies")}>
                Policies
              </Button>
              <Button variant="ghost" className="justify-start" onClick={() => scrollToSection("onboarding")}>
                Onboarding
              </Button>
              <Button variant="ghost" className="justify-start" onClick={() => scrollToSection("faqs")}>
                FAQs
              </Button>
              <Button variant="ghost" className="justify-start" onClick={() => scrollToSection("tenants")}>
                Tenants
              </Button>
              <Button variant="ghost" className="justify-start" onClick={() => scrollToSection("company")}>
                Contact
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => {
                  setMobileMenuOpen(false);
                  nav("/login");
                }}
              >
                Login
              </Button>
              <Button className="justify-start" onClick={goToDemoForm}>
                Book Demo
              </Button>
            </div>
          </div>
        ) : null}
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-10 pt-16">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-700">
              <CircleDot className="h-3 w-3" /> Modern Operating System for Hotels & Shortlets
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
              Product-ready platform for operations, payments, and guest experience.
            </h1>
            <p className="text-lg text-slate-600">
              EazziHotech helps operators move faster with clean workflows, tenant isolation, and a modern sales-ready
              brand experience.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={() => {
                  trackEvent("landing_start_now_click");
                  nav("/login");
                }}
              >
                Start Now <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  trackEvent("landing_explore_ai_click");
                  document.getElementById("ai")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Explore Support and Sales
              </Button>
            </div>
            <div className="grid gap-2 text-sm text-slate-600">
              {features.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <Card className="border-slate-200 bg-white/90 shadow-xl">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-500">Sales Snapshot</div>
                <div className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">Live-ready</div>
              </div>
              <div className="grid gap-3">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Positioning</div>
                  <div className="mt-1 font-semibold">Operations + Revenue + Guest Trust</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Ideal Customer</div>
                  <div className="mt-1 font-semibold">Hotels, shortlets, serviced apartments</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Market Story</div>
                  <div className="mt-1 font-semibold">Built in Nigeria, scalable across Africa</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="tenants" className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-5 flex items-center gap-2 text-slate-800">
          <Users className="h-5 w-5 text-blue-600" />
          <h2 className="text-2xl font-bold">Recently Joined Tenants</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {tenantCards.map((tenant) => (
            <Card key={tenant.id} className="border-blue-200 bg-blue-50/60">
              <CardContent className="space-y-2 p-6">
                <div className="text-xs uppercase tracking-wide text-blue-700">{tenant.joined}</div>
                <div className="text-xl font-bold">{tenant.name}</div>
                <div className="text-slate-700">{tenant.product}</div>
                <div className="text-sm text-slate-600">{tenant.location}</div>
              </CardContent>
            </Card>
          ))}
        </div>
        {loadingTenants ? <p className="mt-3 text-xs text-slate-500">Loading recent tenants...</p> : null}
      </section>

      <section id="policies" className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-5 flex items-center gap-2 text-slate-800">
          <ShieldCheck className="h-5 w-5 text-indigo-600" />
          <h2 className="text-2xl font-bold">Platform Policies</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {policies.map((policy) => (
            <Card key={policy.title} className="border-slate-200 bg-white/90">
              <CardContent className="space-y-2 p-6">
                <div className="font-semibold">{policy.title}</div>
                <p className="text-sm text-slate-600">{policy.body}</p>
                <Button
                  variant="link"
                  className="px-0 text-sm"
                  onClick={() => {
                    trackEvent("landing_policy_click", { policy: policy.href });
                    nav(policy.href);
                  }}
                >
                  Read full policy
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="faqs" className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-5 flex items-center gap-2 text-slate-800">
          <ShieldCheck className="h-5 w-5 text-indigo-600" />
          <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {faqHighlights.map((item) => (
            <Card key={item.q} className="border-slate-200 bg-white/90">
              <CardContent className="space-y-2 p-6">
                <div className="font-semibold">{item.q}</div>
                <p className="text-sm text-slate-600">{item.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="ai" className="mx-auto max-w-6xl px-4 pb-16 pt-10">
        <div className="mb-5 flex items-center gap-2 text-slate-800">
          <Bot className="h-5 w-5 text-emerald-600" />
          <h2 className="text-2xl font-bold">Customer Support and Sales</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {aiUseCases.map((item) => (
            <Card key={item.title} className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="space-y-2 p-6">
                <div className="font-semibold">{item.title}</div>
                <p className="text-sm text-slate-700">{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={openWhatsAppAI}>Start Sales Chat (WhatsApp)</Button>
          <Button
            variant="outline"
            onClick={() => {
              trackEvent("landing_ai_support_click");
              window.open("mailto:support@eazzihotech.com?subject=Customer%20Support%20Request", "_blank");
            }}
          >
            Contact Support by Email
          </Button>
        </div>
      </section>

      <section id="onboarding" className="mx-auto max-w-6xl px-4 pb-12">
        <div className="mb-5 flex items-center gap-2 text-slate-800">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <h2 className="text-2xl font-bold">Onboarding Process</h2>
        </div>
        <Card className="border-emerald-200 bg-white/95">
          <CardContent className="space-y-3 p-6">
            {onboardingSteps.map((step, index) => (
              <div key={step} className="flex items-start gap-3">
                <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-emerald-100 text-center text-xs font-bold leading-6 text-emerald-700">
                  {index + 1}
                </div>
                <p className="text-sm text-slate-700">{step}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section id="company" className="mx-auto max-w-6xl px-4 pb-12">
        <Card className="border-slate-200 bg-white/95">
          <CardContent className="grid gap-4 p-6 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-2xl font-bold">{companyInfo.name}</h3>
              <div className="flex items-start gap-2 text-slate-700">
                <MapPin className="mt-0.5 h-4 w-4 text-indigo-600" />
                <span>{companyInfo.address}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Phone className="h-4 w-4 text-indigo-600" />
                <span>{companyInfo.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Globe className="h-4 w-4 text-indigo-600" />
                <a className="underline" href={companyInfo.websiteHref} target="_blank" rel="noopener noreferrer">
                  {companyInfo.websiteLabel}
                </a>
              </div>
            </div>
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-slate-800">
                <Clock3 className="h-4 w-4 text-emerald-600" />
                <span className="font-semibold">Business Open Hours</span>
              </div>
              <p className="text-sm text-slate-700">{companyInfo.businessHours}</p>
              <p className="text-sm text-slate-700">
                Support coverage: <span className="font-semibold">{companyInfo.supportHours}</span>
              </p>
              <p className="text-sm text-slate-700">
                Support email:{" "}
                <a className="underline" href={`mailto:${companyInfo.supportEmail}`}>
                  {companyInfo.supportEmail}
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="lead-capture" className="mx-auto max-w-6xl px-4 pb-16">
        <Card className="border-amber-200 bg-white/95">
          <CardContent className="p-6">
            <div className="mb-4">
              <h3 className="text-2xl font-bold">Book a Demo</h3>
              <p className="text-slate-600">Submit your details and our sales team will contact you.</p>
            </div>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={submitLead}>
              <input
                className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                placeholder="Company Name *"
                value={leadForm.companyName}
                onChange={(e) => setLeadForm((p) => ({ ...p, companyName: e.target.value }))}
              />
              {leadErrors.companyName ? <p className="text-xs text-red-600">{leadErrors.companyName}</p> : null}

              <input
                className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                placeholder="Contact Name *"
                value={leadForm.contactName}
                onChange={(e) => setLeadForm((p) => ({ ...p, contactName: e.target.value }))}
              />
              {leadErrors.contactName ? <p className="text-xs text-red-600">{leadErrors.contactName}</p> : null}

              <input
                type="email"
                className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                placeholder="Business Email *"
                value={leadForm.email}
                onChange={(e) => setLeadForm((p) => ({ ...p, email: e.target.value }))}
              />
              {leadErrors.email ? <p className="text-xs text-red-600">{leadErrors.email}</p> : null}

              <input
                className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                placeholder="Phone Number"
                value={leadForm.phone}
                onChange={(e) => setLeadForm((p) => ({ ...p, phone: e.target.value }))}
              />
              {leadErrors.phone ? <p className="text-xs text-red-600">{leadErrors.phone}</p> : null}

              <input
                className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-amber-200 md:col-span-2"
                placeholder="Business Type (Hotel, Shortlet, Serviced Apartments)"
                value={leadForm.businessType}
                onChange={(e) => setLeadForm((p) => ({ ...p, businessType: e.target.value }))}
              />

              <textarea
                className="min-h-[100px] rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200 md:col-span-2"
                placeholder="What do you want to improve with EazziHotech?"
                value={leadForm.message}
                onChange={(e) => setLeadForm((p) => ({ ...p, message: e.target.value }))}
              />
              {leadErrors.message ? <p className="text-xs text-red-600 md:col-span-2">{leadErrors.message}</p> : null}

              <input
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={leadForm.website}
                onChange={(e) => setLeadForm((p) => ({ ...p, website: e.target.value }))}
              />

              <div className="md:col-span-2">
                <Button type="submit" disabled={leadSubmitting}>
                  {leadSubmitting ? "Submitting..." : "Submit Lead"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-slate-200 bg-white/90">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-600">
            © {new Date().getFullYear()} {companyInfo.name}. All rights reserved.
          </div>
          <div className="text-sm text-slate-500">Product live and ready for tenant onboarding.</div>
        </div>
      </footer>
    </div>
  );
}
