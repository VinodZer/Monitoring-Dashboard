import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import GlobalErrorGuard from '@/components/global-error-guard'
import { PWARegister } from '@/components/pwa-register'

export const metadata: Metadata = {
  title: 'Market Ticks Monitor - Real-Time Trading Dashboard',
  description: 'Professional real-time market data monitoring with inactivity alerts',
  generator: 'v0.dev',
  applicationName: 'Market Ticks Monitor',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Market Monitor',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    title: 'Market Ticks Monitor',
    description: 'Professional real-time market data monitoring with inactivity alerts',
    url: 'https://marketticks.com',
    images: [
      {
        url: 'https://cdn.builder.io/api/v1/image/assets%2F212686917e6a43feac2002a1e679ce72%2F4232d9a3a4bc400a91ef28288c1e35f6?format=webp&width=1200',
        width: 1200,
        height: 630,
        alt: 'Market Ticks Monitor Dashboard',
      },
    ],
  },
  icons: {
    icon: [
      { url: 'https://cdn.builder.io/api/v1/image/assets%2F212686917e6a43feac2002a1e679ce72%2F4232d9a3a4bc400a91ef28288c1e35f6?format=webp&width=800' },
    ],
    apple: [
      { url: 'https://cdn.builder.io/api/v1/image/assets%2F212686917e6a43feac2002a1e679ce72%2F4232d9a3a4bc400a91ef28288c1e35f6?format=webp&width=180' },
    ],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

/**
 * RootLayout sets up the global HTML structure for the app and wraps content
 * with the ThemeProvider. This file is used by Next's App Router as the root
 * layout for all pages.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <body className="font-sans bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Global client-side guard to suppress noisy third-party errors (e.g., FullStory) */}
          <GlobalErrorGuard />
          {/* PWA service worker registration and mobile optimizations */}
          <PWARegister />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
