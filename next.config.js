/** @type {import('next').NextConfig} */
const now = new Date();
const buildTime = `_${now.getDate().toString().padStart(2, '0')}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getFullYear()}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;

const nextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  env: {
    NEXT_PUBLIC_BUILD_TIME: buildTime,
  },
};

module.exports = nextConfig;