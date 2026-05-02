/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'minio',
        port: '9000',
        pathname: '/**',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
    // MinIO bucket is made publicly downloadable in docker-compose via:
    //   mc anonymous set download local/videos
    // Default base points to the "videos" bucket.
    NEXT_PUBLIC_MINIO_PUBLIC_URL:
      process.env.NEXT_PUBLIC_MINIO_PUBLIC_URL || 'http://localhost:9000/videos',
  },
};

module.exports = nextConfig;
