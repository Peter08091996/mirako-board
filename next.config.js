/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'dist',
  basePath: '/mirako-board',
  assetPrefix: '/mirako-board/',
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
