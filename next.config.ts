import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The bill image reads its fonts from disk at runtime; make sure they ship.
  outputFileTracingIncludes: {
    "/admin/bookings/[date]/export": ["./src/assets/fonts/*.ttf"],
  },
  experimental: {
    // A picture for an email is uploaded through a Server Action (2 MB max,
    // see src/lib/email/limits.ts); the default limit is 1 MB.
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
