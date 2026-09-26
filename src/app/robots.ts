import type { MetadataRoute } from 'next';

/** A private site for doctors: never indexed. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
