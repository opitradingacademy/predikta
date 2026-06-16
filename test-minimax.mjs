// Ejecutar: node test-minimax.mjs TU_API_KEY
const apiKey = process.argv[2]
if (!apiKey) { console.error('Uso: node test-minimax.mjs TU_API_KEY'); process.exit(1) }

const res = await fetch('https://api.minimax.chat/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({
    model: 'MiniMax-Text-01',
    max_tokens: 256,
    tools: [{
      type: 'function',
      function: {
        name: 'clasificar_mercado',
        description: 'Clasifica un mercado de predicción',
        parameters: {
          type: 'object',
          properties: {
            categoria: { type: 'string', enum: ['AUTO_APPROVE', 'NEEDS_REVIEW', 'AUTO_REJECT'] },
            razon: { type: 'string' },
          },
          required: ['categoria', 'razon'],
        },
      },
    }],
    tool_choice: { type: 'function', function: { name: 'clasificar_mercado' } },
    messages: [{ role: 'user', content: '¿Quién ganará el partido Argentina vs Brasil el próximo sábado?' }],
  }),
})

console.log('HTTP status:', res.status)
const data = await res.json()
console.log('Raw response:', JSON.stringify(data, null, 2))

const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]
if (toolCall?.function?.arguments) {
  console.log('\n✅ Tool result:', JSON.parse(toolCall.function.arguments))
} else {
  console.log('\n❌ No tool_call en la respuesta')
}
