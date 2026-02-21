import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { publicFetch } from "@/lib/api";
import { usePageSeo } from "@/lib/usePageSeo";
import { ArrowUpRight, CalendarDays, Clapperboard, Newspaper, PlayCircle, Rss } from "lucide-react";

type NewsType = "ARTICLE" | "VIDEO" | "FEATURE" | "ANNOUNCEMENT";

type PublicNewsItem = {
  id: string;
  title: string;
  slug: string;
  type: NewsType;
  excerpt: string;
  content?: string | null;
  externalUrl?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  isFeatured: boolean;
  publishedAt?: string | null;
  createdAt?: string | null;
};

const fallbackNews: PublicNewsItem[] = [
  {
    id: "fallback-1",
    title: "How EazziHotech reduces front-desk friction from booking to check-out",
    slug: "front-desk-friction-reduction",
    type: "ARTICLE",
    excerpt:
      "A practical walkthrough of booking, payment, check-in, in-house, and check-out workflows for daily operations.",
    externalUrl: "https://www.eazzihotech.com",
    isFeatured: true,
    publishedAt: "2026-02-21T00:00:00.000Z",
  },
];

const socialLinks = [
  { label: "YouTube", href: "https://www.youtube.com/@eazzihotech" },
  { label: "LinkedIn", href: "https://www.linkedin.com" },
  { label: "Instagram", href: "https://www.instagram.com" },
  { label: "X (Twitter)", href: "https://x.com" },
];

function niceType(type: NewsType) {
  if (type === "ANNOUNCEMENT") return "Announcement";
  if (type === "FEATURE") return "Feature";
  if (type === "VIDEO") return "Video";
  return "Article";
}

function niceDate(v?: string | null) {
  if (!v) return "Recently";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "Recently";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function normalizeExternalUrl(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export default function News() {
  const nav = useNavigate();
  const [items, setItems] = useState<PublicNewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  usePageSeo({
    title: "EazziHotech News & Updates",
    description:
      "Read EazziHotech product updates, hospitality operations articles, feature releases, and media content for operators in Nigeria and across Africa.",
    canonicalPath: "/news",
    type: "website",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "EazziHotech News",
      description: "Product updates, hospitality operations insights, and media content from EazziHotech.",
      url: `${window.location.origin}/news`,
      publisher: {
        "@type": "Organization",
        name: "MyEazzi Solution Limited",
        url: "https://www.eazzihotech.com",
      },
    },
  });

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await publicFetch("/api/public/news?limit=40");
        const rows = Array.isArray(data?.news) ? data.news : [];
        if (!canceled) setItems(rows);
      } catch {
        if (!canceled) setItems([]);
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const sourceItems = items.length > 0 ? items : fallbackNews;
  const posts = useMemo(
    () => sourceItems.filter((x) => x.type !== "VIDEO" && (x.externalUrl || x.content || x.excerpt)),
    [sourceItems]
  );
  const videos = useMemo(() => sourceItems.filter((x) => x.type === "VIDEO" || x.videoUrl), [sourceItems]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 overflow-hidden rounded-3xl ring-1 ring-indigo-300">
              <img src="/logo512.png" alt="EazziHotech logo" className="h-full w-full object-contain" />
            </div>
            <span className="text-lg font-bold">EazziHotech Newsroom</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => nav("/")}>
              Back to Landing
            </Button>
            <Button onClick={() => nav("/login")}>Login</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
          <div className="flex items-center gap-2 text-indigo-700">
            <Rss className="h-4 w-4" />
            <span className="text-sm font-semibold uppercase tracking-wide">News & Media</span>
          </div>
          <div className="mt-3 max-w-4xl space-y-4">
            <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
              We are empowering Hotel and Shortlet Owners with Intelligent, Structured Operational Control.
            </h1>
            <p className="text-lg text-slate-600">
              EazziHotech brings bookings, guest lifecycle, payments, reporting, and team accountability into one
              operational system built for modern hospitality operators across Nigeria and Africa.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-indigo-600" />
            <h2 className="text-2xl font-bold">Latest Articles</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => (
              <Card key={post.id} className="border-slate-200 bg-white">
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="rounded-full bg-indigo-50 px-2 py-1 font-medium text-indigo-700">
                      {niceType(post.type)}
                    </span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5" /> {niceDate(post.publishedAt || post.createdAt)}
                    </span>
                  </div>
                  <CardTitle className="text-lg leading-snug">{post.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-600">{post.excerpt}</p>
                  <Link
                    to={`/news/${post.slug}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:underline"
                  >
                    Read more <ArrowUpRight className="h-4 w-4" />
                  </Link>
                  {normalizeExternalUrl(post.externalUrl) ? (
                    <a
                      href={normalizeExternalUrl(post.externalUrl) || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-slate-500 hover:underline"
                    >
                      Source link
                    </a>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
          {loading ? <p className="text-xs text-slate-500">Loading newsroom content...</p> : null}
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Clapperboard className="h-5 w-5 text-rose-600" />
            <h2 className="text-2xl font-bold">Video Highlights</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {videos.length === 0 ? (
              <Card className="border-rose-200 bg-white md:col-span-2">
                <CardContent className="p-6 text-sm text-slate-600">No video highlights yet.</CardContent>
              </Card>
            ) : (
              videos.map((video) => (
                <Card key={video.id} className="border-rose-200 bg-white">
                  <CardContent className="space-y-3 p-6">
                    <div className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">
                      <PlayCircle className="h-3.5 w-3.5" /> {niceType(video.type)}
                    </div>
                    <h3 className="text-lg font-semibold">{video.title}</h3>
                    <p className="text-sm text-slate-600">{video.excerpt}</p>
                    {normalizeExternalUrl(video.videoUrl || video.externalUrl) ? (
                      <a
                        href={normalizeExternalUrl(video.videoUrl || video.externalUrl) || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-rose-700 hover:underline"
                      >
                        Watch now <ArrowUpRight className="h-4 w-4" />
                      </a>
                    ) : null}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6">
          <h2 className="text-xl font-bold">Social Distribution</h2>
          <p className="mt-2 text-sm text-slate-700">
            Update links below anytime as your social channels grow. This keeps your public visibility current.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
              >
                {social.label} <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold">Best Promotion Approach</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>1. Publish one strong product and operations article each week.</p>
            <p>2. Publish one short demo video every 7-10 days and cross-post to socials.</p>
            <p>3. Link each post to your demo form and WhatsApp sales entry point.</p>
            <p>4. Track which channel sends the most qualified leads and double down there.</p>
          </div>
          <div className="mt-4">
            <Button asChild>
              <Link to="/">Go to Demo Capture</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
