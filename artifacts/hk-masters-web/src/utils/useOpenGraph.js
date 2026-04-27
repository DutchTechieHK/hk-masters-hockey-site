import { useEffect } from "react";

const DEFAULTS = {
  title: "HK Masters Hockey",
  description: "Stories, articles, and photos from the HK Masters Hockey community.",
  image: () => `${window.location.origin}/opengraph.jpg`,
  url: () => window.location.origin,
  type: "website",
};

function setMeta(property, content) {
  if (!content) return;
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setMetaName(name, content) {
  if (!content) return;
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function useOpenGraph({ title, description, image, url, type = "article" }) {
  useEffect(() => {
    if (!title) return;

    const prevTitle = document.title;
    document.title = title;

    setMeta("og:title", title);
    setMeta("og:type", type);
    if (description) {
      setMeta("og:description", description);
      setMetaName("description", description);
      setMetaName("twitter:description", description);
    }
    if (image) {
      setMeta("og:image", image);
      setMetaName("twitter:image", image);
    }
    if (url) setMeta("og:url", url);
    setMetaName("twitter:title", title);
    setMetaName("twitter:card", "summary_large_image");

    return () => {
      document.title = prevTitle;
      setMeta("og:title", DEFAULTS.title);
      setMeta("og:type", DEFAULTS.type);
      setMeta("og:description", DEFAULTS.description);
      setMetaName("description", DEFAULTS.description);
      setMeta("og:image", DEFAULTS.image());
      setMeta("og:url", DEFAULTS.url());
      setMetaName("twitter:title", DEFAULTS.title);
      setMetaName("twitter:description", DEFAULTS.description);
      setMetaName("twitter:image", DEFAULTS.image());
    };
  }, [title, description, image, url, type]);
}
