/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Expose mode flags to client components
    NEXT_PUBLIC_PAYMENT_MODE: process.env.PAYMENT_MODE ?? "mock",
    NEXT_PUBLIC_CHAIN_MODE:   process.env.CHAIN_MODE   ?? "mock",
  },
  // Silence build warnings from Mastra/OpenTelemetry optional server modules
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        async_hooks: false,
      };
    }
    return config;
  },
};

export default nextConfig;
