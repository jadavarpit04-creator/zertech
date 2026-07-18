/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lucide-react'],
};

export default nextConfig;

// Sentry webpack plugin — uncomment and add SENTRY_AUTH_TOKEN to enable source maps
// import { withSentryConfig } from "@sentry/nextjs";
// export default withSentryConfig(nextConfig, {
//   silent: true,
//   org: process.env.SENTRY_ORG,
//   project: process.env.SENTRY_PROJECT,
//   authToken: process.env.SENTRY_AUTH_TOKEN,
// });
