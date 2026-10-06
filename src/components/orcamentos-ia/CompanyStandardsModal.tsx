import { useEffect, useState, type ReactNode } from 'react'
import { Loader2, Save, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DEFAULT_SYSTEM_PREFERENCES,
  getSystemPreferences,
  upsertSystemPreferences,
  type SystemPreferences,
} from '@/lib/orcamentos-ia/system-preferences'

interface CompanyStandardsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
}

export function CompanyStandardsModal({
  open,
  onOpenChange,
  companyId,
}: CompanyStandardsModalProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<SystemPreferences>(() => DEFAULT_SYSTEM_PREFERENCES(companyId))

  useEffect(() => {
    if (!open || !companyId) return

    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const prefs = await getSystemPreferences(companyId)
        if (!cancelled) setForm(prefs)
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Falha ao carregar preferências')
          setForm(DEFAULT_SYSTEM_PREFERENCES(companyId))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, companyId])

  const save = async () => {
    setSaving(true)
    try {
      await upsertSystemPreferences({ ...form, company_id: companyId })
      toast.success('Preferências construtivas salvas.')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-slate-200 bg-[#f7f4ef] text-slate-900 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Settings2 className="h-5 w-5 text-[#0066FF]" />
            Preferências construtivas
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            Regras de montagem Corte Claude (v11) aplicadas no desmonte BOM — base/tampo, fixação,
            fundo e folgas.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando preferências…
          </div>
        ) : (
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Base da caixa">
                <Select
                  value={form.base_assembly}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      base_assembly: v as SystemPreferences['base_assembly'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="under_sides">Passante (por baixo)</SelectItem>
                    <SelectItem value="between_sides">Entre laterais</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tampo">
                <Select
                  value={form.top_assembly}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      top_assembly: v as SystemPreferences['top_assembly'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="over_sides">Por cima das laterais</SelectItem>
                    <SelectItem value="between_sides">Entre laterais</SelectItem>
                    <SelectItem value="inside">Por dentro</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Espessura caixaria">
                <Select
                  value={String(form.box_thickness_mm)}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      box_thickness_mm: Number(v) as SystemPreferences['box_thickness_mm'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 mm</SelectItem>
                    <SelectItem value="18">18 mm</SelectItem>
                    <SelectItem value="25">25 mm</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Fixação padrão">
                <Select
                  value={form.mounting_device}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      mounting_device: v as SystemPreferences['mounting_device'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minifix_dowel">Minifix + cavilha</SelectItem>
                    <SelectItem value="screw">Parafuso estrutural</SelectItem>
                    <SelectItem value="dowel_only">100% cavilha</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tipo de fundo">
                <Select
                  value={form.back_panel_type}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      back_panel_type: v as SystemPreferences['back_panel_type'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grooved">Rasgado (canal)</SelectItem>
                    <SelectItem value="rebated">Rebaixado</SelectItem>
                    <SelectItem value="screwed">Pregado/parafusado</SelectItem>
                    <SelectItem value="reinforced">Fundo reforçado</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Espessura fundo">
                <Select
                  value={String(form.back_panel_thickness)}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      back_panel_thickness: Number(v) as SystemPreferences['back_panel_thickness'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 mm</SelectItem>
                    <SelectItem value="6">6 mm</SelectItem>
                    <SelectItem value="15">15 mm</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Corrediças">
              <Select
                value={form.drawer_slide_type}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    drawer_slide_type: v as SystemPreferences['drawer_slide_type'],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="telescopic">Telescópica</SelectItem>
                  <SelectItem value="telescopic_light">Telescópica Light</SelectItem>
                  <SelectItem value="hidden_soft_close">Oculta com amortecedor</SelectItem>
                  <SelectItem value="touch">Oculta fecho toque</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Folga frentes (mm)">
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  value={form.front_gap_mm}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      front_gap_mm: Number(e.target.value) || 0,
                    }))
                  }
                />
              </Field>
              <Field label="Recuo prateleira (mm)">
                <Input
                  type="number"
                  min={0}
                  value={form.shelf_recess_mm}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      shelf_recess_mm: Number(e.target.value) || 0,
                    }))
                  }
                />
              </Field>
            </div>

            <Field label="Política de bordeamento">
              <Select
                value={form.edgeband_policy}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    edgeband_policy: v as SystemPreferences['edgeband_policy'],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="front_only">Apenas frente</SelectItem>
                  <SelectItem value="visible_edges">Topos aparentes</SelectItem>
                  <SelectItem value="all_edges">Todos os topos</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void save()} disabled={loading || saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar preferências
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold text-slate-700">{label}</Label>
      {children}
    </div>
  )
}
