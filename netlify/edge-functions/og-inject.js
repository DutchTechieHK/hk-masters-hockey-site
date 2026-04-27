const API_BASE = "https://masters-world-hub.replit.app";

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function cloudinaryOgImage(url) {
  if (!url || !url.includes("cloudinary.com")) return url;
  return url.replace("/upload/", "/upload/w_1200,h_630,c_fill,q_auto,f_jpg/");
}

function replaceMetaProperty(html, property, value) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(`(<meta property="${escaped}" content=")[^"]*(")`),
    `$1${escapeHtml(value)}$2`
  );
}

function replaceMetaName(html, name, value) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(`(<meta name="${escaped}" content=")[^"]*(")`),
    `$1${escapeHtml(value)}$2`
  );
}

export default async function handler(request, context) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);

  if (pathParts.length < 2 || pathParts[0] !== "journal") {
    return context.next();
  }

  const slug = pathParts[1];

  let article;
  try {
    const apiRes = await fetch(
      `${API_BASE}/api/contributions/approved/${encodeURIComponent(slug)}`,
      { headers: { "User-Agent": "Netlify-Edge-OG/1.0" } }
    );
    if (!apiRes.ok) return context.next();
    article = await apiRes.json();
  } catch {
    return context.next();
  }

  const spaResponse = await context.next();
  let html = await spaResponse.text();

  const ogTitle = `${article.title} — HK Masters Hockey`;
  const rawDesc = (article.articleBody || "").trim().replace(/\s+/g, " ");
  const ogDescription =
    rawDesc.length > 0
      ? rawDesc.slice(0, 160)
      : "Read more on HK Masters Hockey.";
  const hasPhoto = Array.isArray(article.photoUrls) && article.photoUrls.length > 0;
  const ogImage = hasPhoto
    ? cloudinaryOgImage(article.photoUrls[0])
    : `${url.origin}/opengraph.jpg`;
  const identifier = article.slug || article.id;
  const ogUrl = `${url.origin}/journal/${identifier}`;

  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(ogTitle)}</title>`
  );

  html = replaceMetaProperty(html, "og:title", ogTitle);
  html = replaceMetaProperty(html, "og:description", ogDescription);
  html = replaceMetaProperty(html, "og:image", ogImage);
  html = replaceMetaProperty(html, "og:type", "article");

  html = replaceMetaName(html, "description", ogDescription);
  html = replaceMetaName(html, "twitter:title", ogTitle);
  html = replaceMetaName(html, "twitter:description", ogDescription);
  html = replaceMetaName(html, "twitter:image", ogImage);

  html = html.replace(
    "</head>",
    `  <meta property="og:url" content="${escapeHtml(ogUrl)}" />\n</head>`
  );

  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    ...(ogDescription && { description: ogDescription }),
    ...(hasPhoto && { image: ogImage }),
    ...(article.authorName && {
      author: {
        "@type": "Person",
        name: article.authorName,
      },
    }),
    ...(article.createdAt && { datePublished: article.createdAt }),
    url: ogUrl,
  };

  const safeJsonLd = JSON.stringify(schema)
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

  html = html.replace(
    "</head>",
    `  <script type="application/ld+json">${safeJsonLd}</script>\n</head>`
  );

  const responseHeaders = new Headers(spaResponse.headers);
  responseHeaders.set("content-type", "text/html; charset=utf-8");

  return new Response(html, {
    status: spaResponse.status,
    headers: responseHeaders,
  });
}
