/** @type {import('next').NextConfig} */
const nextConfig = {
  //   async rewrites() {
  //     return [
  //       {
  //         source: "/api/:path*",
  //         destination: "http://localhost:5000/api/:path*",
  //       },
  //       {
  //         source: "/socket.io/:path*",
  //         destination: "http://localhost:5000/socket.io/:path*",
  //       },
  //     ];
  //   },
  async headers() {
    return [
      {
        source: "/firebase-messaging-sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
