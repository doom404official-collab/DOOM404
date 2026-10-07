export const metadata = {
  title: "DOOM404 Wallet Signal",
  description: "Explainable Solana wallet activity signals by DOOM404",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
