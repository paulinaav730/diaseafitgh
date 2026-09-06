/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Allows production builds to successfully complete even if there are subtle type differences
    ignoreBuildErrors: false,
  },
  env: {
    NEXT_PUBLIC_APP_NAME: 'DÍAS EAFIT 2026',
  },
};

export default nextConfig;
