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
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    // Ignore x402 evm client to fix coinbase sdk build error
    config.resolve.alias = {
      ...config.resolve.alias,
      '@x402/evm/upto/client': false,
      '@x402/evm/exact/client': false,
      '@x402/core/client': false,
      '@x402/svm/exact/client': false,
      '@x402/evm': false,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
