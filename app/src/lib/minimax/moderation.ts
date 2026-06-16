import type { ModerationResult } from '@/types'

const MINIMAX_BASE_URL = 'https://api.minimax.io/anthropic/v1'
const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID ?? ''

const MODERATION_TOOL = {
  name: 'clasificar_mercado',
  description: 'Clasifica un mercado de predicción según las políticas de Predikta',
  input_schema: {
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
}

function buildPrompt(title: string, description: string, sourceUrl?: string | null): string {
  return `Sos un moderador de mercados de predicción. Analizá el siguiente mercado y clasificalo.

TÍTULO: ${title}
DESCRIPCIÓN: ${description}
FUENTE DE VERIFICACIÓN: ${sourceUrl ?? 'No especificada'}

CONTENIDO PROHIBIDO — AUTO_REJECT si contiene cualquiera de estos:
- Datos personales o información privada de individuos
- Salud o condición médica individual
- Violencia, amenazas o incitación al odio
- Suicidio o autolesión
- Contenido sexual o para adultos
- Difamación o calumnias sobre personas reales
- Actividades ilegales
- Información privilegiada o insider trading
- Resultado imposible de verificar objetivamente

NEEDS_REVIEW solo si hay ambigüedad real sobre si viola algún punto anterior. Si el mercado claramente NO viola ninguno, NO uses NEEDS_REVIEW.

AUTO_APPROVE si el mercado no viola ningún punto del contenido prohibido. Ejemplos: deportes, política electoral pública, clima, economía, entretenimiento, cultura, tecnología, cualquier evento público verificable.

La mayoría de los mercados deben ser AUTO_APPROVE. Sé restrictivo solo con contenido claramente prohibido.

Clasificá el mercado usando la función clasificar_mercado.`
}

export async function moderateMarket(
  title: string,
  description: string,
  sourceUrl?: string | null
): Promise<ModerationResult> {
  const response = await fetch(`${MINIMAX_BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
      'MM-GroupId': MINIMAX_GROUP_ID,
    },
    body: JSON.stringify({
      model: 'MiniMax-Text-01',
      max_tokens: 256,
      tools: [MODERATION_TOOL],
      tool_choice: { type: 'tool', name: 'clasificar_mercado' },
      system: 'You MUST always respond by calling the clasificar_mercado function. Never respond with plain text.',
      messages: [{ role: 'user', content: buildPrompt(title, description, sourceUrl) }],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`MiniMax API error: ${response.status} — ${body}`)
  }

  const data = await response.json()
  const toolUse = data.content?.find((c: { type: string }) => c.type === 'tool_use')

  if (!toolUse?.input) {
    console.error('[moderation] MiniMax raw response:', JSON.stringify(data, null, 2))
    throw new Error('MiniMax did not return tool_use response')
  }

  return toolUse.input as ModerationResult
}
