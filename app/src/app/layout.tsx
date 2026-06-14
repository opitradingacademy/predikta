import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { BottomNav } from '@/components/layout/BottomNav'
import { WagmiClientProvider } from '@/providers/WagmiClientProvider'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Predikta — Mercados de Predicción',
  description: 'Transforma opiniones en mercados verificables. Predikta en MiniPay.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} dark h-full antialiased`}>
      <body className="min-h-full bg-[#0A0A0F] text-white font-sans">
        <WagmiClientProvider>
          <main className="max-w-md mx-auto pb-20 min-h-screen">
            {children}
          </main>
          <BottomNav />
          <Toaster theme="dark" position="top-center" />
        </WagmiClientProvider>
      </body>
    </html>
  )
}
