import type { MetadataRoute } from "next";

import { DEPCUT_CANONICAL } from "@/cut/lib/hosts";

// Served at depcut.com/sitemap.xml via the proxy rewrite (src/proxy.ts).
// The legal pages are canonical on this host, since they describe DepCut.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${DEPCUT_CANONICAL}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${DEPCUT_CANONICAL}/install`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${DEPCUT_CANONICAL}/depcutvision`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${DEPCUT_CANONICAL}/privacy`,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${DEPCUT_CANONICAL}/terms`,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
