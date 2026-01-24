import "./globals.css";

export const metadata = {
  title: "Amor Compartido",
  description: "Comparte tareas con tu pareja 💕",
  manifest: "/manifest.json",
  themeColor: "#F48FB1",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Amor Compartido",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}

