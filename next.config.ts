import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The bill image reads its fonts from disk at runtime; make sure they ship.
  outputFileTracingIncludes: {
    "/admin/bookings/[date]/export": ["./src/assets/fonts/*.ttf"],
  },
};

export default nextConfig;
