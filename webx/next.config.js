/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // vm2 and coffee-script are Node.js only modules
    // They should never be bundled for browser use
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        vm2: false,
        'coffee-script': false,
        fs: false,
        path: false,
        child_process: false,
        module: false,
      };
    }

    // Treat Node.js modules as external - don't bundle them
    const externalModules = [
      'vm2',
      'coffee-script',
      '@byted/kiana',
      'deasync',
      'node-jq',
    ];

    config.externals = [...(Array.isArray(config.externals) ? config.externals : [config.externals]), ...externalModules];

    return config;
  },
}

module.exports = nextConfig
