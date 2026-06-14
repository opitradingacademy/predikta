import { createConfig, http } from 'wagmi'
import { celo, celoAlfajores } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

const celoSepolia = {
  ...celoAlfajores,
  id: 11142220,
  name: 'Celo Sepolia',
  rpcUrls: {
    default: { http: ['https://forno.celo-sepolia.celo-testnet.org'] },
  },
} as const

const isMainnet = process.env.NEXT_PUBLIC_CHAIN_ID === '42220'

export const wagmiConfig = isMainnet
  ? createConfig({
      chains: [celo],
      connectors: [injected()],
      transports: { [celo.id]: http('https://forno.celo.org') },
    })
  : createConfig({
      chains: [celoSepolia],
      connectors: [injected()],
      transports: { [celoSepolia.id]: http('https://forno.celo-sepolia.celo-testnet.org') },
    })
