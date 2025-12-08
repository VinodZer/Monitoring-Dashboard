/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Allow dev overlay / HMR requests from external preview origins used by the platform
  // Add any preview hostnames here to avoid cross-origin fetch failures during dev
  allowedDevOrigins: [
    "http://localhost:3000",
    "https://faaeb541dade4ca88801e0f494af766a-93f744c6-e92a-4cb4-9319-82b905.projects.builder.codes",
    "https://faaeb541dade4ca88801e0f494af766a-93f744c6-e92a-4cb4-9319-82b905.fly.dev",
  ],
}

export default nextConfig;
