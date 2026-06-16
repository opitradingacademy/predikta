# Migración Testnet → Mainnet

Referencia para migrar Predikta de Celo Sepolia (testnet) a Celo Mainnet — y para revertir si hace falta.

---

## Estado actual (testnet)

| Variable | Valor |
|---|---|
| Chain | Celo Sepolia — ID `11142220` |
| Contrato | `0xa468ba20dd8AB475a8d78d0cF2ec7Cf334ECEBA4` |
| Token de prueba (tUSDm) | `0x7cc8b6e9fe615490db19a89991042fe1976d1832` |
| RPC | `https://forno.celo-sepolia.celo-testnet.org` |

---

## Pasos para migrar a Mainnet

### 1 — Redesployar el contrato en Mainnet

```bash
export PATH="$PATH:/c/Users/demo/.foundry/bin"
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url https://forno.celo.org \
  --broadcast \
  --private-key $RESOLVER_PRIVATE_KEY
```

Anotar la dirección del contrato deployado — la necesitás en el paso 2.

### 2 — Actualizar variables en Vercel

| Variable | Testnet (actual) | Mainnet |
|---|---|---|
| `NEXT_PUBLIC_CHAIN_ID` | `11142220` | `42220` |
| `NEXT_PUBLIC_PREDIKTA_CONTRACT` | `0xa468ba20dd8AB475a8d78d0cF2ec7Cf334ECEBA4` | `<nueva dirección>` |
| `RESOLVER_PRIVATE_KEY` | (misma wallet si querés) | wallet con CELO mainnet para gas |

> ⚠️ Cambiar variables en Vercel no redeploya solo. Hacer redeploy manual o `git commit --allow-empty && git push`.

### 3 — Patch en código (un solo archivo)

**`app/src/components/market/MarketDetailClient.tsx`** — línea ~136

```diff
- chain: celoSepolia as unknown as typeof celoAlfajores,
+ chain: celo,
```

Y actualizar el import en la misma línea (~12):

```diff
- import { celoAlfajores } from 'viem/chains'
+ import { celo } from 'viem/chains'
```

### 4 — Verificar el contrato en Celoscan

```bash
forge verify-contract <nueva-dirección> \
  src/PrediktaMarket.sol:PrediktaMarket \
  --chain-id 42220 \
  --etherscan-api-key $CELOSCAN_API_KEY
```

---

## Lo que se activa solo (sin tocar código)

El código ya tiene lógica dual vía `isMainnet = process.env.NEXT_PUBLIC_CHAIN_ID === '42220'`:

| Archivo | Comportamiento en mainnet |
|---|---|
| `app/src/lib/wagmi/config.ts` | Wagmi conecta a `celo` con RPC `forno.celo.org` |
| `app/src/lib/contracts/predikta.ts` | `TOKENS` apunta a contratos mainnet reales |
| `app/src/lib/contracts/predikta.ts` | `publicClient` usa RPC mainnet |

### Tokens Mainnet (ya configurados en el código)

| Token | Dirección Mainnet |
|---|---|
| USDm | `0x765DE816845861e75A25fCA122bb6898B8B1282a` |
| USDC | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` |
| USDT | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` |

---

## Rollback a testnet

1. En Vercel revertir:
   - `NEXT_PUBLIC_CHAIN_ID` → `11142220`
   - `NEXT_PUBLIC_PREDIKTA_CONTRACT` → `0xa468ba20dd8AB475a8d78d0cF2ec7Cf334ECEBA4`
2. Revertir el patch de `MarketDetailClient.tsx` (volver a `celoSepolia`).
3. Redeploy manual en Vercel.
