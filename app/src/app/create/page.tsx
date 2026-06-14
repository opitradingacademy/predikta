'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createMarket } from '@/actions/market.actions'
import { toast } from 'sonner'
import type { MarketCategory, ResolutionSource } from '@/types'

const CATEGORIES: { value: MarketCategory; label: string }[] = [
  { value: 'deportes',      label: '⚽ Deportes'      },
  { value: 'comunidad',     label: '🏘️ Comunidad'     },
  { value: 'clima',         label: '🌤️ Clima'         },
  { value: 'educacion',     label: '📚 Educación'     },
  { value: 'tecnologia',    label: '💻 Tecnología'    },
  { value: 'politica_local', label: '🏛️ Política Local' },
  { value: 'otros',         label: '✨ Otros'         },
]

const RESOLUTION_SOURCES: { value: ResolutionSource; label: string }[] = [
  { value: 'deportivo',     label: '🏆 Resultado deportivo' },
  { value: 'fuente_publica', label: '📰 Fuente pública'     },
  { value: 'meteorologico', label: '🌦️ Dato meteorológico'  },
  { value: 'institucional', label: '🏛️ Resultado institucional' },
  { value: 'organizador',   label: '👤 Organizador autorizado' },
  { value: 'comunitario',   label: '🤝 Verificación comunitaria' },
]

export default function CreatePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState(['Sí', 'No'])
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '' as MarketCategory,
    closeDate: '',
    resolutionSource: '' as ResolutionSource,
    resolutionSourceUrl: '',
  })

  function addOption() {
    if (options.length < 10) setOptions([...options, ''])
  }

  function removeOption(i: number) {
    if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i))
  }

  function updateOption(i: number, value: string) {
    const next = [...options]
    next[i] = value
    setOptions(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (options.some(o => !o.trim())) {
      toast.error('Completá todas las opciones')
      return
    }

    setLoading(true)
    try {
      // En prod, la wallet viene del contexto MiniPay
      const wallet = (window as unknown as { ethereum?: { selectedAddress?: string } }).ethereum?.selectedAddress ?? ''
      const result = await createMarket({
        ...form,
        options,
        creatorWallet: wallet,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('¡Mercado creado exitosamente!')
        router.push('/')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <h1 className="text-xl font-bold text-white mb-6">Crear Mercado</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Título */}
        <div className="space-y-2">
          <Label className="text-white/70">¿Qué vas a predecir?</Label>
          <Input
            placeholder="ej: ¿Ganará el equipo local el torneo?"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>

        {/* Descripción */}
        <div className="space-y-2">
          <Label className="text-white/70">Descripción</Label>
          <Textarea
            placeholder="Contexto, condiciones y cómo se verificará el resultado..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            rows={3}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
          />
        </div>

        {/* Categoría */}
        <div className="space-y-2">
          <Label className="text-white/70">Categoría</Label>
          <Select onValueChange={(v) => setForm({ ...form, category: v as MarketCategory })} required>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Seleccioná una categoría" />
            </SelectTrigger>
            <SelectContent className="bg-[#0A0A0F] border-white/10">
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value} className="text-white focus:bg-white/10">
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Opciones */}
        <div className="space-y-2">
          <Label className="text-white/70">Opciones</Label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder={`Opción ${i + 1}`}
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 flex-1"
                />
                {options.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(i)}
                    className="text-white/40 hover:text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          {options.length < 10 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addOption}
              className="text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 w-full"
            >
              <Plus className="w-4 h-4 mr-1" /> Agregar opción
            </Button>
          )}
        </div>

        {/* Fuente de verificación */}
        <div className="space-y-2">
          <Label className="text-white/70">¿Cómo se verificará?</Label>
          <Select onValueChange={(v) => setForm({ ...form, resolutionSource: v as ResolutionSource })} required>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Fuente de verificación" />
            </SelectTrigger>
            <SelectContent className="bg-[#0A0A0F] border-white/10">
              {RESOLUTION_SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-white focus:bg-white/10">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="URL de la fuente (opcional)"
            value={form.resolutionSourceUrl}
            onChange={(e) => setForm({ ...form, resolutionSourceUrl: e.target.value })}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>

        {/* Fecha de cierre */}
        <div className="space-y-2">
          <Label className="text-white/70">Fecha de cierre</Label>
          <Input
            type="datetime-local"
            value={form.closeDate}
            onChange={(e) => setForm({ ...form, closeDate: e.target.value })}
            required
            min={new Date(Date.now() + 3_600_000).toISOString().slice(0, 16)}
            className="bg-white/5 border-white/10 text-white"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-semibold h-12 rounded-xl"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creando...</>
          ) : (
            '🔮 Crear Mercado'
          )}
        </Button>
      </form>
    </div>
  )
}
