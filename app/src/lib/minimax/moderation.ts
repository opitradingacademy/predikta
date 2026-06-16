import type { ModerationResult } from '@/types'

const MINIMAX_BASE_URL = process.env.MINIMAX_BASE_URL ?? 'https://api.minimax.chat/v1'

const MODERATION_TOOL = {
  type: 'function' as const,
  function: {
    name: 'clasificar_mercado',
    description: 'Clasifica un mercado de predicción según las políticas de Predikta',
    parameters: {
      type: 'object',
      properties: {
        categoria: {
          type: 'string',
          enum: ['AUTO_APPROVE', 'NEEDS_REVIEW', 'AUTO_REJECT'],
          description: 'Clasificación del mercado',
        },
        razon: {
          type: 'string',
          description: 'Explicación breve de la clasificación',
        },
      },
      required: ['categoria', 'razon'],
    },
  },
}

function buildPrompt(title: string, description: string, sourceUrl?: string | null): string {
  return `Sos un moderador de mercados de predicción. Analizá el siguiente mercado y clasificalo.

TÍTULO: ${title}
DESCRIPCIÓN: ${description}
FUENTE DE VERIFICACIÓN: ${sourceUrl ?? 'No especificada'}

REGLAS DE CLASIFICACIÓN:

AUTO_REJECT si contiene:
- Datos personales o información privada de individuos
- Contenido sobre salud o condición médica individual
- Violencia, amenazas o incitación al odio
- Contenido sexual o para adultos
- Difamación o calumnias sobre personas reales
- Actividades ilegales
- Información privilegiada o insider trading
- Es imposible de verificar objetivamente

NEEDS_REVIEW si:
- Tiene potencial político sensible
- Involucra a personas públicas de forma no obvia
- La fuente de verificación es dudosa o no está clara
- El resultado podría ser manipulable

AUTO_APPROVE si:
- Es sobre eventos deportivos locales verificables
- Es sobre fenómenos climáticos o naturales
- Es sobre resultados institucionales públicos
- Es claramente comunitario y verificable
- No viola ninguna regla anterior

Clasificá el mercado usando la función clasificar_mercado.`
}

export async function moderateMarket(
  title: string,
  description: string,
  sourceUrl?: string | null
): Promise<ModerationResult> {
  const response = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'MiniMax-Text-01',
      max_tokens: 256,
      tools: [MODERATION_TOOL],
      tool_choice: { type: 'function', function: { name: 'clasificar_mercado' } },
      messages: [{ role: 'user', content: buildPrompt(title, description, sourceUrl) }],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`MiniMax API error: ${response.status} — ${body}`)
  }

  const data = await response.json()

  // OpenAI-compatible response format
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]
  if (!toolCall?.function?.arguments) {
    console.error('[moderation] MiniMax raw response:', JSON.stringify(data, null, 2))
    throw new Error('MiniMax did not return tool_call response')
  }

  const parsed = JSON.parse(toolCall.function.arguments)
  return parsed as ModerationResult
}
