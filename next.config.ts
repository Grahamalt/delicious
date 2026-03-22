import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};

export default nextConfig;
