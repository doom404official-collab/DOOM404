import "./GlitchPresentation.css";
import "./ScannerHome.css";
export const metadata = {
  title: "DOOM404 GLITCH Scanner",
  description: "Evidence-based Solana token risk intelligence by DOOM404",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body data-deployment-environment={process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development" ? "preview" : "production"} style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
