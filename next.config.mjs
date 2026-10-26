const isDev = process.env.NODE_ENV !== "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "3001",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "jobs-api.dadu.edu.et",
        pathname: "/uploads/**",
      },
    ],
    // allow local Strapi assets during development
    unoptimized: isDev,
    // Allow images from localhost that resolve to private IPs (127.0.0.1, ::1)
    // Enable this when running locally (even if NODE_ENV is set incorrectly)
    dangerouslyAllowLocalIP: true, // Always allow in dev - you can change this to isDevelopment if preferred
  },
};

export default nextConfig;
