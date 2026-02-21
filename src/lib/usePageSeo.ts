import { useEffect } from "react";

type SeoOptions = {
  title: string;
  description: string;
  canonicalPath?: string;
  imagePath?: string;
  type?: "website" | "article";
  noindex?: boolean;
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
};

function upsertMetaByName(name: string, content: string) {
  let el = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertMetaByProperty(property: string, content: string) {
  let el = document.head.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(url: string) {
  let el = document.head.querySelector(`link[rel="canonical"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", url);
}

function upsertStructuredData(payload: SeoOptions["structuredData"]) {
  const id = "page-structured-data";
  let el = document.head.querySelector(`#${id}`) as HTMLScriptElement | null;
  if (!payload) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.text = JSON.stringify(payload);
}

export function usePageSeo({
  title,
  description,
  canonicalPath = "/",
  imagePath = "/og-share.png",
  type = "website",
  noindex = false,
  structuredData,
}: SeoOptions) {
  useEffect(() => {
    const origin = window.location.origin;
    const canonicalUrl = `${origin}${canonicalPath}`;
    const imageUrl = imagePath.startsWith("http") ? imagePath : `${origin}${imagePath}`;

    document.title = title;
    upsertMetaByName("description", description);
    upsertMetaByName("robots", noindex ? "noindex, nofollow" : "index, follow");

    upsertMetaByProperty("og:type", type);
    upsertMetaByProperty("og:site_name", "EazziHotech");
    upsertMetaByProperty("og:title", title);
    upsertMetaByProperty("og:description", description);
    upsertMetaByProperty("og:url", canonicalUrl);
    upsertMetaByProperty("og:image", imageUrl);
    upsertMetaByProperty("og:image:secure_url", imageUrl);

    upsertMetaByName("twitter:card", "summary_large_image");
    upsertMetaByName("twitter:title", title);
    upsertMetaByName("twitter:description", description);
    upsertMetaByName("twitter:image", imageUrl);

    upsertCanonical(canonicalUrl);
    upsertStructuredData(structuredData);
  }, [canonicalPath, description, imagePath, noindex, structuredData, title, type]);
}
