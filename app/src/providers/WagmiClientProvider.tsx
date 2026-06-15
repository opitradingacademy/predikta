'use client'

import { WagmiProvider, useConnect, useAccount } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { wagmiConfig } from '@/lib/wagmi/config'
import { useEffect } from 'react'

const queryClient = new QueryClient()

function MiniPayAutoConnect() {
  const { connect, connectors } = useConnect()
  const { isConnected } = useAccount()

  useEffect(() => {
    if (isConnected) return
    if (typeof window === 'undefined' || !window.ethereum) return

    const tryConnect = () => {
      const connector = connectors.find(c => c.id === 'injected')
      if (!connector) return
      connect({ connector })
    }

    // Intentar inmediatamente y luego con delay por si ethereum no está listo
    tryConnect()
    const t = setTimeout(tryConnect, 500)
    return () => clearTimeout(t)
  }, [isConnected, connect, connectors])

  return null
}

export function WagmiClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <MiniPayAutoConnect />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
