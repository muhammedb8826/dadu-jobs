const isDev = process.env.NODE_ENV !== "production";
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const apiRemotePattern = (() => {
  if (!apiBaseUrl) return null;
  try {
    const url = new URL(apiBaseUrl);
    return {
      protocol: url.protocol.replace(":", ""),
      hostname: url.hostname,
      port: url.port || undefined,
      pathname: "/uploads/**",
    };
  } catch {
    return null;
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "1337",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "jobs-portal.qenenia.com",
        pathname: "/uploads/**",
      },
      ...(apiRemotePattern ? [apiRemotePattern] : []),
    ],
    // allow local Strapi assets during development
    unoptimized: isDev,
  },
};

export default nextConfig;
