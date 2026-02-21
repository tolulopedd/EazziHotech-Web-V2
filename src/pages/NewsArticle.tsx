import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { publicFetch } from "@/lib/api";
import { renderMarkdown } from "@/lib/markdown";
import { usePageSeo } from "@/lib/usePageSeo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, CalendarDays } from "lucide-react";

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
  publishedAt?: string | null;
  createdAt?: string | null;
};

function niceDate(v?: string | null) {
  if (!v) return "Recently";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "Recently";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function normalizeUrl(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export default function NewsArticle() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<PublicNewsItem | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const data = await publicFetch(`/api/public/news/${encodeURIComponent(String(slug || ""))}`);
        if (!canceled) setItem(data?.news || null);
      } catch (err: any) {
        if (!canceled) {
          setItem(null);
          setError(err?.message || "Article not found");
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [slug]);

  const pageTitle = useMemo(() => {
    if (item?.title) return `${item.title} | EazziHotech News`;
    return "News Article | EazziHotech";
  }, [item?.title]);
  const pageDescription = item?.excerpt || "Read the latest EazziHotech article.";

  usePageSeo({
    title: pageTitle,
    description: pageDescription,
    canonicalPath: `/news/${slug || ""}`,
    type: "article",
  });

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" onClick={() => nav("/news")}>
            Back to News
          </Button>
          <Button onClick={() => nav("/login")}>Login</Button>
        </div>

        {loading ? <Card><CardContent className="p-6 text-sm text-slate-500">Loading article...</CardContent></Card> : null}

        {!loading && error ? (
          <Card>
            <CardContent className="space-y-4 p-6">
              <h1 className="text-xl font-bold">Article not available</h1>
              <p className="text-sm text-slate-600">{error}</p>
              <Button asChild>
                <Link to="/news">Go to newsroom</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {!loading && item ? (
          <article className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">{item.type}</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{item.title}</h1>
            <p className="mt-2 flex items-center gap-1 text-sm text-slate-500">
              <CalendarDays className="h-4 w-4" /> {niceDate(item.publishedAt || item.createdAt)}
            </p>
            <p className="mt-5 text-lg text-slate-700">{item.excerpt}</p>
            {item.content ? (
              <div
                className="mt-5 text-slate-700 [&_.md-spacer]:h-4 [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-3xl [&_h1]:font-bold [&_h1:first-child]:mt-0 [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2:first-child]:mt-0 [&_h3]:mb-3 [&_h3]:mt-5 [&_h3]:text-xl [&_h3]:font-semibold [&_h3:first-child]:mt-0 [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&_a]:text-indigo-700 [&_a]:underline [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(item.content) }}
              />
            ) : null}

            {normalizeUrl(item.externalUrl || item.videoUrl) ? (
              <div className="mt-6">
                <a
                  href={normalizeUrl(item.externalUrl || item.videoUrl) || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:underline"
                >
                  Open source link <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            ) : null}
          </article>
        ) : null}
      </div>
    </div>
  );
}
