# CLAUDE.md — Predikta

Mini App para MiniPay (Celo) de mercados de predicción. Mercado global (cualquier usuario MiniPay, 60+ países, 14M+ wallets).

---

## Principios fundamentales

- Confianza > Volumen
- Calidad > Cantidad
- Mercados verificables > Mercados virales
- Máximo 3 clics para participar (mobile-first estricto)

---

## Stack

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend + Backend | Next.js 14 (App Router) | Server Actions + API Routes. Sin BFF separado. |
| DB + Real-time + Auth + Storage | Supabase | Sin Redis en MVP. Real-time reemplaza pub/sub. |
| UI Components | shadcn/ui + TailwindCSS | Dark mode nativo. |
| Animaciones | Framer Motion | Transiciones fluidas mobile. |
| Blockchain | Viem + Wagmi | Estándar para Celo/MiniPay. |
| Moderación IA | MiniMax Token Plan API | Anthropic-compatible format. Tool calling forzado. |
| Deploy | Vercel + Supabase Cloud | Zero-config. |

### Lo que NO usamos y por qué

- **Redis**: Supabase Real-time + materialized views cubren los casos de uso del MVP.
- **NestJS**: Next.js Server Actions cubren la lógica compleja sin servicio separado.

---

## Diseño

- **Tema**: Dark (`#0A0A0F` base)
- **Acento Sí**: gradiente azul-violeta (`#4F46E5` → `#7C3AED`)
- **Acento No**: gradiente rojo-naranja (`#DC2626` → `#EA580C`)
- **Estilo cards**: glassmorphism
- **Visual core**: barras de probabilidad animadas (Framer Motion)
- **Tipografía**: Inter (números nítidos para montos y porcentajes)
- **Referencia**: Polymarket + Farcaster Frames, más accesible para usuarios emergentes

---

## Tokens y blockchain

- **Tokens permitidos**: USDm, USDC, USDT
- **NUNCA** mostrar CELO a usuarios (MiniPay lo oculta y maneja internamente)
- `cUSD` está renombrado a `USDm` — usar siempre el nombre nuevo
- Fee abstraction: USDm para gas (CIP-64)
- USDC adapter (fee): `0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B`
- USDT adapter (fee): `0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72`
- Celo Chain ID: 42220 (Mainnet), 44787 (Alfajores Testnet)

---

## Modelo de negocio

- Comisión: **5% por mercado resuelto**
  - 4% → Predikta
  - 1% → Creador del mercado
- Ejemplo: pool 1.000 USDm → ganadores 950 + Predikta 40 + creador 10

---

## Módulos MVP

1. Login con MiniPay (wallet connect, detección `window.ethereum.isMiniPay`)
2. Perfil de usuario (ganancias, mercados, aciertos, Trust Score, nivel, badges)
3. Creación de mercados
4. Participación en mercados
5. Resolución de mercados
6. Distribución automática de premios (smart contract)
7. Ranking
8. Trust Score
9. Moderación (IA + administrativa)
10. Dashboard administrativo

---

## Trust Score

- Rango: 0–100 | Inicial: 50
- **Incrementos**: aprobado +2 | resuelto +3 | exitoso +2 | activo +1/mes | verificado +10
- **Penalizaciones**: rechazado -10 | reporte -15 | engañoso -25 | fraude -100

### Niveles

| Nivel | Requisitos | Beneficios |
|---|---|---|
| Nuevo Usuario | Trust Score < 80 | Publicación manual, máx 3 mercados/día |
| Creador Verificado | ≥80 + 10 mercados + 30 días | Publicación automática |
| Creador Premium | ≥90 + 50 mercados | Destacados, mayor visibilidad |

---

## Gamificación

- **Niveles**: Bronce → Plata → Oro → Diamante → Oráculo
- **Badges**: Primer acierto, 10 aciertos, 100 aciertos, Creador destacado, Oráculo local

---

## Moderación IA (MiniMax)

```typescript
// Formato Anthropic-compatible. Tool choice SIEMPRE forzado.
tool_choice: { type: "tool", name: "clasificar_mercado" }

// Categorías de salida
"AUTO_APPROVE" | "NEEDS_REVIEW" | "AUTO_REJECT"
```

**Pipeline**: Creación → IA Moderadora → Revisión → Aprobación/Rechazo → Publicación

### Contenido prohibido

Datos personales, salud individual, violencia, suicidio, sexual, difamación, actividades ilegales, información privilegiada, mercados no verificables.

---

## Verificación de mercados

Cada mercado debe declarar su fuente: resultado deportivo, fuente pública, dato meteorológico, resultado institucional, organizador autorizado, o verificación comunitaria.

---

## Smart Contracts

Responsabilidades on-chain:
- Custodia de fondos
- Pools de participación
- Distribución automática de premios
- Comisiones (4% + 1%)
- Resolución de mercados

**Los fondos no dependen de custodia manual de Predikta.**

---

## Estructura del proyecto

```
C:\opi\Predikta\
├── CLAUDE.md                          ← este archivo
├── Predikta_Prompt_Maestro.md         ← visión original del producto
├── contracts/                         ← Foundry (Solidity)
│   ├── foundry.toml
│   ├── src/PrediktaMarket.sol         ✅ contrato principal
│   ├── script/Deploy.s.sol            ✅ deploy a Celo/Alfajores
│   └── test/PrediktaMarket.t.sol      ✅ 11/11 tests pasando
└── app/                               ← Next.js 16.2.9 (Turbopack)
    └── src/
        ├── types/index.ts             ✅ todos los tipos TypeScript
        ├── lib/
        │   ├── supabase/client.ts     ✅ browser client
        │   ├── supabase/server.ts     ✅ SSR client (solo next/headers, sin service role)
        │   ├── supabase/service.ts    ✅ service role client (separado — ver gotchas)
        │   ├── minimax/moderation.ts  ✅ tool calling MiniMax
        │   └── contracts/predikta.ts  ✅ ABI + viem + tokens Celo
        ├── actions/
        │   ├── market.actions.ts      ✅ crear / participar / resolver / claim / listar
        │   └── user.actions.ts        ✅ perfil + trust score
        ├── components/
        │   ├── market/ProbabilityBar  ✅ barras animadas Framer Motion
        │   ├── market/MarketCard      ✅ glassmorphism dark
        │   ├── market/MarketDetailClient ✅ detalle + apuesta + claim
        │   ├── layout/BottomNav       ✅ nav mobile 5 tabs
        │   └── profile/TrustScore     ✅ barra animada
        └── app/
            ├── layout.tsx             ✅ Inter + dark + BottomNav + Toaster
            ├── page.tsx               ✅ Home (solo approved + active) + HomeHeader
            ├── explore/page.tsx       ✅ filtros categoría + search
            ├── create/page.tsx        ✅ formulario + CloseDatePicker días/horas/min
            ├── admin/page.tsx         ✅ pending + resolve (approved+active) + trust
            ├── profile/page.tsx       ✅ stats + badges + historial + botón admin
            └── notifications/page.tsx ✅ lista con íconos + marca leídas al abrir
```

---

## Estado actual

### ✅ Completado

| Módulo | Detalle |
|---|---|
| Base de datos | 12 tablas, 14 ENUMs, índices, triggers, RLS en Supabase |
| Smart Contract | `PrediktaMarket.sol` — 11/11 tests. Fees, pools, claim, refund. |
| Scaffold Next.js 16 | App Router + shadcn/ui + Framer Motion + Viem + Supabase |
| Moderación IA | ✅ **Funcionando en producción**. URL: `api.minimax.io/anthropic/v1/messages`. Requiere `MM-GroupId` header + system message para forzar tool use. AUTO_APPROVE → registra on-chain automáticamente. NEEDS_REVIEW → admin recibe notificación. |
| Server Actions | Crear mercado (con moderación), resolver, listar, perfil, trust score, aprobar on-chain |
| Componentes UI | ProbabilityBar, MarketCard, BottomNav, TrustScore, MarketDetailClient |
| Páginas | Home, Explore, Create, Profile, Market/[id], Admin, Ranking, Notifications |
| Deploy | GitHub: opitradingacademy/predikta · Vercel: predikta-eight.vercel.app |
| Wagmi + MiniPay | Fallback directo a `window.ethereum` cuando Wagmi no conecta. Chain: Celo Mainnet 42220 |
| **Contrato deployado** | **Celo Mainnet: `0xF9EcfF87833B53594351F2030d4149583B50AC75`** |
| Resolver wallet | `0xdfc0F35940Df64d1bB46103250b5a8EA99EaDa52` — wallet que firma txs on-chain desde Server Actions |
| Flujo aprobación | Admin aprueba → registra on-chain → status approved → apostable |
| Botón Admin | Visible en /profile solo para wallet admin (`0x5288AcFd5c2371f880b4A2BBEE8aF647bD9a051b`) |
| **Flujo apuesta** | ✅ **Funcionando end-to-end en MiniPay** — participations registra en Supabase |
| **Auto-registro usuario** | ✅ `upsertUser()` llamado en `createMarket` y `participateMarket` — primer uso crea el user automáticamente |
| **Flujo resolución + claim** | ✅ Admin resuelve → ganadores ven botón claim → on-chain → Supabase marca `claimed` |
| **Referidos on-chain** | ✅ Primer mercado → referido del admin (treasury). Primera apuesta → referido del creador |
| **Notificaciones automáticas** | ✅ `createNotification` helper. Eventos: aprobación, rechazo, resolución, won/lost, trust score, **market_pending** (creador + admin cuando queda en revisión manual) |
| **Bell con badge real-time** | ✅ Header del home. Supabase Realtime. Tab Perfil en BottomNav (reemplazó Alertas) |
| **Trust Score automático** | ✅ Triggers Supabase. +2 aprobado, -10 rechazado, +3 resuelto, +2 ganado. `supabase/trust_score_triggers.sql` |
| **Auto-cierre mercados vencidos** | ✅ pg_cron cada minuto (testing) / hora (prod). pending→cancelled, approved/active→closed. `supabase/market_status_cron.sql` |
| **Countdown tiempo restante** | ✅ MarketCard y MarketDetailClient muestran `Xd Xh Xm`, se refresca cada 30s con `useTimeLeft` hook |
| **Labels MiniPay-compliant** | ✅ "apostar/apuesta" → "participar/participación". "¿Cuándo cierra la apuesta?" → "¿Cuándo cierra la predicción?" |
| **Admin: bloqueo resolve** | ✅ Botón "Resolver" deshabilitado si `close_date` no pasó. Muestra countdown "Disponible en Xh Xm" |
| **Selector de token** | ✅ Creación de mercado: selector USDm / USDC / USDT. El token queda fijo en el contrato. |
| **Balance visible** | ✅ Panel de participación muestra balance del token requerido. Aviso rojo + botón deshabilitado si balance=0 |
| **Migración a Mainnet** | ✅ **Celo Mainnet (42220)**. Contrato: `0xF9EcfF87833B53594351F2030d4149583B50AC75`. Deployer/Resolver: `0xdfc0F35940Df64d1bB46103250b5a8EA99EaDa52`. Ver `MAINNET_MIGRATION.md` para rollback. |

### 🔲 Pendiente

| Prioridad | Tarea | Detalle |
|---|---|---|
| 🟢 Baja | Upload imagen de mercado | Supabase Storage bucket `market-images`. |

---

## Gotchas técnicos descubiertos

- **Next.js 16 + Turbopack instalado** (no 14). Puede diferir de la documentación oficial de Next.js 14.
- **Separar service.ts de server.ts**: En Next.js 16, un archivo que importa `next/headers` no puede coexistir con funciones que se resuelven en contexto browser. `server.ts` = solo SSR client con cookies. `service.ts` = solo service role client sin cookies.
- **Supabase PGRST201 — FK ambigua**: Cuando hay dos FKs entre dos tablas, especificar siempre la relación: `options!options_market_id_fkey(*)` en lugar de `options(*)`. Afecta cualquier query que joinee `markets` con `options`.
- **Bash heredoc pierde UTF-8**: Los inserts SQL vía bash/jq pierden acentos en español. Para datos de prueba usar el dashboard de Supabase o psql con `PGCLIENTENCODING=UTF8`. No afecta producción.
- **Supabase Management API** requiere PAT (`sbp_...`), no la service role key, para DDL.
- **jq escaping**: usar `jq -n --arg q "$SQL" '{"query": $q}'` para SQL con newlines y comillas simples.
- **MiniMax API**: URL correcta `https://api.minimax.io/anthropic/v1/messages`. Requiere header `MM-GroupId`. Sin system message forzando el tool use, el modelo responde con texto libre ignorando `tool_choice`. No dejar `MINIMAX_BASE_URL` en Vercel — pisaría el default correcto con la URL vieja.
- **Cambiar env vars en Vercel no redeploya**: hay que hacer redeploy manual o `git commit --allow-empty && git push`.
- **marketId on-chain** = `keccak256(UUID de Supabase)` — linkea on-chain con off-chain sin oracle.
- **Foundry PATH**: agregar `export PATH="$PATH:/c/Users/demo/.foundry/bin"` en cada sesión bash nueva.
- **Deploy.s.sol env vars**: requiere `TREASURY_ADDRESS`, `DEPLOYER_ADDRESS`, `RESOLVER_ADDRESS`, y `PRIVATE_KEY` (con prefijo `0x`). Sin el prefijo falla con "missing hex prefix".
- **pk.txt**: guardar private keys en `pk.txt` en la raíz. Asegurarse de que esté en el `.gitignore` de la RAÍZ (no solo en `app/.gitignore`).
- **MiniPay wallet**: no usar botón "Conectar" — auto-connect con Wagmi `useAccount` + conector `injected`. NO usar `useConnection` (no existe en Wagmi v2).
- **market_status enum**: pending, approved, active, closed, resolved, rejected, cancelled. Sin `needs_review`.
- **moderation_status enum**: pending, auto_approved, needs_review, auto_rejected. Sin `approved`/`rejected`.
- **Mercado apostable**: `status === 'approved' || status === 'active'` — recién aprobados son 'approved', no 'active'.
- **createMarket on-chain**: debe llamarse desde `adminUpdateMarket` al aprobar, ANTES de actualizar Supabase. Si ya existe on-chain, ignorar el error `Market already exists`.
- **Celo Sepolia tokens**: ningún stablecoin conocido existe. Usar TestToken deployado: `0x7cc8b6e9fe615490db19a89991042fe1976d1832`.
- **tsconfig target**: debe ser ES2020 para BigInt literals (`0n`).
- **Wallet lowercase**: siempre `.toLowerCase()` antes de queries a Supabase. MiniPay devuelve mixed case.
- **USDm decimals**: 18. USDC/USDT: 6. El contrato lo maneja transparentemente con SafeERC20.
- **Wagmi no auto-conecta en MiniPay** (primer acceso, sin sesión previa). Solución en `MarketDetailClient`: fallback con `eth_requestAccounts` + `createWalletClient({ transport: custom(window.ethereum) })`. `window.ethereum.request` devuelve `unknown` → castear `as string[]`. `window.ethereum` es posiblemente undefined según TS → usar `!`.
- **Auto-registro usuario**: `upsertUser(wallet)` debe llamarse al inicio de `createMarket` y `participateMarket`. Es no-op si ya existe. Sin esto, usuarios nuevos reciben "usuario no encontrado".
- **NEXT_PUBLIC_TREASURY_ADDRESS**: debe estar en `.env.local` Y en Vercel para que los referidos on-chain funcionen. Wallet admin: `0x5288AcFd5c2371f880b4A2BBEE8aF647bD9a051b`. Sin esta variable, el bloque de referidos se saltea silenciosamente. ✅ Configurado en Vercel.
- **FK ambigua en resolveMarket**: `options(*)` falla si hay múltiples FKs. Usar siempre `options!options_market_id_fkey(*)`.
- **Admin "Resolver" carga approved + active**: el tab resolve debe traer ambos status, no solo `approved`.
- **Home filtra solo approved + active**: nunca mostrar `resolved`, `cancelled`, `pending`, `rejected`. `resolveMarket` debe llamar `revalidatePath('/')` y `revalidatePath('/explore')` — sin esto la caché no se invalida al resolver.
- **NEXT_PUBLIC_* en Client Components**: se reemplaza en BUILD TIME. Si la variable tiene mixed case y la comparación espera lowercase, va a fallar. Siempre aplicar `.toLowerCase()` al leer del env var. Afectó al botón admin en `/profile`.
- **BottomNav**: Inicio · Explorar · Crear · Ranking · Perfil. Bell de notificaciones está en el header del home (`HomeHeader.tsx`), no en el nav.
- **total_markets_won**: debe incrementarse en `resolveMarket` al marcar participaciones como `won`. No se actualiza automáticamente.
- **Contrato: resolveMarket requiere `block.timestamp >= closeDate`**: no se puede resolver antes de que pase la fecha. Para testing usar cierre en 30m–1h.
- **Limpiar Supabase para testing**: `UPDATE markets SET resolved_option_id = NULL` PRIMERO, luego DELETE en orden: participations → resolutions → trust_score_history → notifications → rankings → markets → options.
- **Claim flow**: `userParticipation.status` determina qué ve el usuario en mercado resuelto: `won` → botón claim, `claimed` → banner "ya reclamadas", `lost` → mensaje aliento, null → nada.
- **MiniPay usa Celo Mainnet por defecto**. Para testnet: Settings → Developer → Test Networks. Sin esto da error "chain mismatch (42220 vs 11142220)".
- **chain type mismatch en viem**: al pasar celoSepolia donde se espera celoAlfajores, usar `as unknown as typeof celoAlfajores`. En mainnet ya no aplica — usar `celo` de viem/chains directamente.
- **ENUMs en triggers Supabase**: `level` es `user_level`, `reason` es `trust_reason` — siempre castear con `::user_level` y `::trust_reason`. Valores válidos de trust_reason: market_approved, market_resolved, market_successful, time_active, identity_verified, market_rejected, report_confirmed, misleading_content, fraud.
- **pg_cron en testing**: usar `'* * * * *'` para cada minuto. Producción: `'0 * * * *'`. Para cambiar: `cron.unschedule('nombre-job')` + recrear.
- **Admin tab Resolver**: carga approved + active + closed — los tres estados apostables o listos para resolver.
- **Mainnet deploy — wallets**: la wallet MiniPay/treasury (`0x5288...`) y la wallet resolver/deployer (`0xdfc0F359...`) son distintas. CELO para gas va al resolver, no a la MiniPay. La wallet `0xA3A12179...` quedó comprometida (key expuesta en chat) — no usar más.
- **Mainnet deploy — bootstrap gas**: USDT en la wallet no alcanza para gas en Foundry. Fee abstraction solo funciona en txs internas de MiniPay, no en `forge script`. Necesitás CELO nativo en la wallet del resolver.
- **Token fijo por mercado**: el contrato fija el token al crear (`m.token`). `placeBet` siempre usa ese token — no hay forma de pagar con otro. Si el usuario no tiene el token exacto, la tx revierte con "ERC20: transfer amount exceeds balance".
- **MiniPay copy rules**: nunca usar "apostar", "apuesta", "gas", "crypto" en strings visibles. Usar "participar", "participación", "network fee", "stablecoin". Identificadores de código pueden quedarse como están.
- **useEffect orden en React**: un `useEffect` que referencia una variable declarada más abajo con `useState`/`const` falla en TS con "used before declaration". Mover el effect DESPUÉS de la declaración.

---

## Variables de entorno necesarias

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://qntwlmkfwkrosjxmqeee.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<obtener de Supabase dashboard → API → anon key>
SUPABASE_SERVICE_ROLE_KEY=<ya configurado>

# Celo
NEXT_PUBLIC_CHAIN_ID=42220
NEXT_PUBLIC_PREDIKTA_CONTRACT=0xF9EcfF87833B53594351F2030d4149583B50AC75
RESOLVER_PRIVATE_KEY=<wallet que actúa como resolver del contrato>

# MiniMax (URL hardcodeada en código — NO configurar MINIMAX_BASE_URL en Vercel)
MINIMAX_API_KEY=<tu API key de MiniMax>
MINIMAX_GROUP_ID=2047224044209582897
```

---

## Orden de desarrollo

```
1. Modelo de datos       ✅ completado
2. Smart Contracts       ✅ completado (11/11 tests)
3. Scaffold completo     ✅ completado
4. /market/[id] + bet    ✅ completado
5. Wagmi + MiniPay connect ✅ completado
6. Deploy Mainnet        ✅ completado (Celo 42220)
7. /ranking + /admin     ✅ completado
8. Real-time + notificaciones ✅ completado
9. Deploy Vercel         ✅ completado — predikta-eight.vercel.app
```

---

## Reglas para Claude en este proyecto

- Usar voseo rioplatense en respuestas en español.
- Nunca agregar Redis hasta que los números lo justifiquen post-MVP.
- Nunca mostrar o sugerir CELO como token de usuario.
- Siempre usar `USDm` (no `cUSD`).
- Tool calling forzado en cualquier integración de clasificación con MiniMax.
- Mobile-first estricto: cualquier componente se diseña primero para 360×640.
- Máximo 3 clics para cualquier acción crítica del usuario.
- shadcn/ui como base de componentes — no reinventar UI primitives.
- Al conectar wallet: auto-connect sin botón (patrón MiniPay).
- Antes de empezar una sesión nueva: leer este archivo + `mem_context` para recuperar estado.
