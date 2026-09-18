import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 예전 링크 호환. 캔버스 주소는 /think/… 로 바뀌었다.
  redirects: async () => [{ source: "/p/:path*", destination: "/think/:path*", permanent: true }],
};

export default nextConfig;
