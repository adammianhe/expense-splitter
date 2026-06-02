import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  /* config options here */
}


import withPWAInit from "next-pwa"

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
})

export default withPWA(nextConfig as any)