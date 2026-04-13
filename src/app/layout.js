import "./globals.css";

export const metadata = {
  title: "CasparCG MP4 Player",
  description: "Play MP4 files to CasparCG from a Next.js app.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
