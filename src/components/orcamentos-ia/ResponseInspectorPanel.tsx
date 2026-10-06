interface ResponseInspectorPanelProps {
  payload: Record<string, unknown> | null
}

export function ResponseInspectorPanel({ payload }: ResponseInspectorPanelProps) {
  if (!payload) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        Sem traces ainda. Eles aparecem após a análise ou no desmonte local.
      </p>
    )
  }

  let text = ''
  try {
    text = JSON.stringify(payload, null, 2)
  } catch {
    text = String(payload)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#0066FF]">
          Response Inspector
        </p>
        <p className="text-[11px] text-muted-foreground">JSON bruto para depuração</p>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto bg-[#0f1419] p-3 font-mono text-[10px] leading-relaxed text-[#c8d0da]">
        {text}
      </pre>
    </div>
  )
}
