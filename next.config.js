import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable for better performance
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  // Handle CSV and JSON file imports
  webpack: (config) => {
    config.module.rules.push({
      test: /\.csv$/,
      loader: 'file-loader',
      options: {
        publicPath: '/_next/static/files/',
        outputPath: 'static/files/',
      },
    });
    
    // Set up path aliases
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, './src'),
    };
    
    return config;
  },
  // Page extensions
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  // Environment variables
  env: {
    TZ: 'Australia/Sydney',
  },
};

export default nextConfig;