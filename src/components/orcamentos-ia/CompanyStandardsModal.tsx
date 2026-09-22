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
import { supabase } from '@/lib/supabase'

export interface CompanyStandardsRow {
  id?: string
  company_id: string
  box_thickness: string
  back_panel_thickness: string
  assembly_method: string
  bottom_fixing: string
  tamponamento_rule: string
  door_handle_discount_mm: number
  handle_bar_length_m: number
  constructive_method: string
  shelf_support: string
  wall_fixing: string
  drawer_slide: string
}

const DEFAULT_STANDARDS = (companyId: string): CompanyStandardsRow => ({
  company_id: companyId,
  box_thickness: '15mm',
  back_panel_thickness: '6mm',
  assembly_method: 'minifix_cavilha',
  bottom_fixing: 'rebaixo',
  tamponamento_rule: 'empresa_25mm',
  door_handle_discount_mm: 35,
  handle_bar_length_m: 3.0,
  constructive_method: 'metodo_a',
  shelf_support: 'suporte_2_furos',
  wall_fixing: 'cantoneira_3_furos',
  drawer_slide: 'telescopica_450_45kg',
})

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
  const [form, setForm] = useState<CompanyStandardsRow>(() => DEFAULT_STANDARDS(companyId))

  useEffect(() => {
    if (!open || !companyId) return

    let cancelled = false
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('company_standards')
        .select(
          'id, company_id, box_thickness, back_panel_thickness, assembly_method, bottom_fixing, tamponamento_rule, door_handle_discount_mm, handle_bar_length_m, constructive_method, shelf_support, wall_fixing, drawer_slide',
        )
        .eq('company_id', companyId)
        .maybeSingle()

      if (cancelled) return
      if (error) {
        toast.error(error.message)
        setForm(DEFAULT_STANDARDS(companyId))
      } else if (data) {
        setForm(data as CompanyStandardsRow)
      } else {
        setForm(DEFAULT_STANDARDS(companyId))
      }
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, companyId])

  const save = async () => {
    setSaving(true)
    const payload = {
      company_id: companyId,
      box_thickness: form.box_thickness,
      back_panel_thickness: form.back_panel_thickness,
      assembly_method: form.assembly_method,
      bottom_fixing: form.bottom_fixing,
      tamponamento_rule: form.tamponamento_rule,
      door_handle_discount_mm: form.door_handle_discount_mm,
      handle_bar_length_m: form.handle_bar_length_m,
      constructive_method: form.constructive_method,
      shelf_support: form.shelf_support,
      wall_fixing: form.wall_fixing,
      drawer_slide: form.drawer_slide,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('company_standards').upsert(payload, {
      onConflict: 'company_id',
    })

    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Padrões da marcenaria salvos.')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-slate-200 bg-[#f7f4ef] text-slate-900 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Settings2 className="h-5 w-5 text-[#0066FF]" />
            Central de Informações
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            Padrões construtivos da Planilha 4.0 usados pela IA ao orçar (esqueleto editável —
            Fase 2).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando padrões…
          </div>
        ) : (
          <div className="grid gap-4 py-2">
            <Field label="Método construtivo">
              <Select
                value={form.constructive_method}
                onValueChange={(v) => setForm((f) => ({ ...f, constructive_method: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="metodo_a">Método A</SelectItem>
                  <SelectItem value="metodo_b">Método B</SelectItem>
                  <SelectItem value="metodo_c">Método C</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Espessura caixaria">
                <Select
                  value={form.box_thickness}
                  onValueChange={(v) => setForm((f) => ({ ...f, box_thickness: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15mm">15 mm</SelectItem>
                    <SelectItem value="18mm">18 mm</SelectItem>
                    <SelectItem value="25mm">25 mm</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Espessura fundo">
                <Select
                  value={form.back_panel_thickness}
                  onValueChange={(v) => setForm((f) => ({ ...f, back_panel_thickness: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3mm">3 mm</SelectItem>
                    <SelectItem value="6mm">6 mm</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Conectores / montagem">
              <Select
                value={form.assembly_method}
                onValueChange={(v) => setForm((f) => ({ ...f, assembly_method: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minifix_cavilha">Minifix + cavilha</SelectItem>
                  <SelectItem value="vb35">VB35</SelectItem>
                  <SelectItem value="rafix">Rafix</SelectItem>
                  <SelectItem value="parafuso_40x4">Parafuso 40×4</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Desconto puxador (mm)">
                <Input
                  type="number"
                  min={0}
                  value={form.door_handle_discount_mm}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      door_handle_discount_mm: Number(e.target.value) || 0,
                    }))
                  }
                />
              </Field>
              <Field label="Barra de puxador (m)">
                <Input
                  type="number"
                  step="0.1"
                  min={0}
                  value={form.handle_bar_length_m}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      handle_bar_length_m: Number(e.target.value) || 3,
                    }))
                  }
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Planilha 4.0: usar estritamente barras de 3 m.
                </p>
              </Field>
            </div>

            <Field label="Corrediças">
              <Select
                value={form.drawer_slide}
                onValueChange={(v) => setForm((f) => ({ ...f, drawer_slide: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="telescopica_450_45kg">Telescópica 450 mm 45 kg HF</SelectItem>
                  <SelectItem value="oculta_amortecedor">Oculta com amortecedor</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Fixação na parede">
              <Select
                value={form.wall_fixing}
                onValueChange={(v) => setForm((f) => ({ ...f, wall_fixing: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cantoneira_2_furos">Cantoneira 2 furos</SelectItem>
                  <SelectItem value="cantoneira_3_furos">Cantoneira 3 furos</SelectItem>
                  <SelectItem value="regua_mdf_45">Régua MDF 45º</SelectItem>
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
            Salvar padrões
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
