import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Skip type checking during build (already done by tsc)
  typescript: {
    ignoreBuildErrors: false,
  },
  // Skip ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Experimental features for React 19 compatibility
  experimental: {
    // Disable static generation for error pages
  },
};

export default nextConfig;
