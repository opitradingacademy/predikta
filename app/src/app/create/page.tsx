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

function CloseDatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [days, setDays]       = useState('')
  const [hours, setHours]     = useState('')
  const [minutes, setMinutes] = useState('')

  function apply(d: string, h: string, m: string) {
    const total =
      (parseInt(d) || 0) * 24 * 60 * 60 * 1000 +
      (parseInt(h) || 0) * 60 * 60 * 1000 +
      (parseInt(m) || 0) * 60 * 1000
    if (total <= 0) { onChange(''); return }
    onChange(new Date(Date.now() + total).toISOString().slice(0, 16))
  }

  function setPreset(ms: number) {
    const d = Math.floor(ms / (24 * 60 * 60 * 1000))
    const h = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    const m = Math.floor((ms % (60 * 60 * 1000)) / 60000)
    const ds = d ? String(d) : ''
    const hs = h ? String(h) : ''
    const ms2 = m ? String(m) : ''
    setDays(ds); setHours(hs); setMinutes(ms2)
    apply(ds, hs, ms2)
  }

  const presets = [
    { label: '30m', ms: 30 * 60 * 1000 },
    { label: '1h',  ms: 60 * 60 * 1000 },
    { label: '6h',  ms: 6 * 60 * 60 * 1000 },
    { label: '1d',  ms: 24 * 60 * 60 * 1000 },
    { label: '3d',  ms: 3 * 24 * 60 * 60 * 1000 },
    { label: '7d',  ms: 7 * 24 * 60 * 60 * 1000 },
  ]

  return (
    <div className="space-y-3">
      <Label className="text-white/70">¿Cuándo cierra la predicción?</Label>
      <div className="flex gap-1.5">
        {presets.map(p => (
          <button
            key={p.label}
            type="button"
            onClick={() => setPreset(p.ms)}
            className="flex-1 py-2 rounded-xl text-xs font-medium border bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Días',    val: days,    set: setDays,    max: 365, placeholder: '0' },
          { label: 'Horas',   val: hours,   set: setHours,   max: 23,  placeholder: '0' },
          { label: 'Minutos', val: minutes, set: setMinutes, max: 59,  placeholder: '0' },
        ].map(({ label, val, set, max, placeholder }) => (
          <div key={label} className="space-y-1">
            <p className="text-[10px] text-white/40 text-center">{label}</p>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={max}
              placeholder={placeholder}
              value={val}
              onChange={e => {
                set(e.target.value)
                apply(
                  label === 'Días'    ? e.target.value : days,
                  label === 'Horas'   ? e.target.value : hours,
                  label === 'Minutos' ? e.target.value : minutes,
                )
              }}
              className="w-full text-center bg-white/5 border border-white/10 text-white rounded-xl py-2.5 text-lg font-bold focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        ))}
      </div>
      {value && (
        <p className="text-xs text-white/30 text-center">
          Cierra el {new Date(value).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}

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
    token: 'USDm' as 'USDm' | 'USDC' | 'USDT',
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

        {/* Token */}
        <div className="space-y-2">
          <Label className="text-white/70">Token de participación</Label>
          <div className="flex gap-2">
            {(['USDm', 'USDC', 'USDT'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setForm({ ...form, token: t })}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  form.token === t
                    ? 'bg-violet-600 border-violet-500 text-white'
                    : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-white/30">Los participantes deberán tener {form.token} en Celo para unirse.</p>
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
        <CloseDatePicker
          value={form.closeDate}
          onChange={(v) => setForm({ ...form, closeDate: v })}
        />

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
