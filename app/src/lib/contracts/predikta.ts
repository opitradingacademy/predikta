import { createPublicClient, createWalletClient, http, keccak256, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, celoAlfajores } from 'viem/chains'

const celoSepolia = {
  ...celoAlfajores,
  id: 11142220,
  name: 'Celo Sepolia',
  rpcUrls: { default: { http: ['https://forno.celo-sepolia.celo-testnet.org'] } },
} as const

const isMainnet = process.env.NEXT_PUBLIC_CHAIN_ID === '42220'
const activeChain = isMainnet ? celo : celoSepolia
const activeRpc   = isMainnet ? 'https://forno.celo.org' : 'https://forno.celo-sepolia.celo-testnet.org'

export const PREDIKTA_ABI = [
  {
    name: 'createMarket',
    type: 'function',
    inputs: [
      { name: 'marketId', type: 'bytes32' },
      { name: 'token', type: 'address' },
      { name: 'optionCount', type: 'uint8' },
      { name: 'closeDate', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'placeBet',
    type: 'function',
    inputs: [
      { name: 'marketId', type: 'bytes32' },
      { name: 'optionIndex', type: 'uint8' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'resolveMarket',
    type: 'function',
    inputs: [
      { name: 'marketId', type: 'bytes32' },
      { name: 'winningOption', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'claimWinnings',
    type: 'function',
    inputs: [{ name: 'marketId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'cancelMarket',
    type: 'function',
    inputs: [{ name: 'marketId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'refund',
    type: 'function',
    inputs: [{ name: 'marketId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'setReferrer',
    type: 'function',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'ref',  type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'referrers',
    type: 'function',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    name: 'getProbabilities',
    type: 'function',
    inputs: [{ name: 'marketId', type: 'bytes32' }],
    outputs: [{ name: 'probs', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    name: 'getMarket',
    type: 'function',
    inputs: [{ name: 'marketId', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'creator', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'closeDate', type: 'uint256' },
          { name: 'totalPool', type: 'uint256' },
          { name: 'optionCount', type: 'uint8' },
          { name: 'winningOption', type: 'uint8' },
          { name: 'status', type: 'uint8' },
        ],
      },
    ],
    stateMutability: 'view',
  },
] as const

// UUID → bytes32 para linkear Supabase con on-chain
export function uuidToBytes32(uuid: string): `0x${string}` {
  return keccak256(toHex(uuid))
}

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PREDIKTA_CONTRACT as `0x${string}`

// Tokens en Celo Mainnet
export const TOKENS = {
  USDm: '0x765DE816845861e75A25fCA122bb6898B8B1282a' as `0x${string}`,
  USDC: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' as `0x${string}`,
  USDT: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e' as `0x${string}`,
}

export const publicClient = createPublicClient({
  chain: activeChain as typeof celo,
  transport: http(activeRpc),
})

// Resolver client — usado solo en Server Actions
export function getResolverClient() {
  const key = process.env.RESOLVER_PRIVATE_KEY as `0x${string}`
  const account = privateKeyToAccount(key)
  return createWalletClient({ account, chain: activeChain as typeof celo, transport: http(activeRpc) })
}
