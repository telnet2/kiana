import path from 'node:path';
import { fileURLToPath } from 'node:url';
// no direct webpack import needed

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
    externalDir: true,
  },
  transpilePackages: [
    'ai',
    '@ai-sdk/openai-compatible',
    '@byted/kiana',
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    if (isServer) {
      // Keep vm2 on server; mark optional compilers as externals so bundler doesn't try to resolve them
      const externals = config.externals || [];
      externals.push('vm2', 'coffee-script', 'typescript');
      config.externals = externals;
    } else {
      // Stub vm2 in the client bundle
      config.resolve.alias['vm2'] = path.join(__dirname, 'src/server/shims/vm2.js');
      config.resolve.alias['coffee-script'] = false;
      config.resolve.alias['typescript'] = false;
    }
    return config;
  }
};

export default nextConfig;
