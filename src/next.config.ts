import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Dynamic pages (force-dynamic or using cookies/headers) must not be
    // served from the client-side router cache on back navigation. We show
    // scrape/post counts that change out-of-band via the JobTracker; stale
    // RSC payloads would show pre-scrape data until the user hard-refreshes.
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
