# Validação Raio-X 3D — job `a57f1f9f`

| Campo | Valor |
| ----- | ----- |
| Data | 2026-10-15 |
| Analysis | `a57f1f9f-cdc0-4bc1-b971-cec63bafbda7` |
| URL | http://localhost:3000/orcamentos-ia?audit=a57f1f9f-cdc0-4bc1-b971-cec63bafbda7 |
| Escopo | Geometria / materiais Raio-X (sem preço) |

## Checklist Épico 4

| Módulo | Contador | Fundo | Base | Resultado |
| ------ | -------- | ----- | ---- | --------- |
| Cristaleira | 1 / 8 | sim (múltiplos na legenda) | sim | **PASS** — fundos/prateleiras em vãos, não empilhados no centro |
| Bancada Lavabo | 3 / 8 | sim | sim | **PASS** — caixaria + fundo no rebanho 10 mm (smoke Z) |
| Mesa de jantar | 5 / 8 | não | não | **PASS** — só tampo/pés (sem fantasma) |

## Smoke automatizado

```text
node scripts/test-orcamentos-ia-xray-geometry.mjs
→ E5 OK — geometria raio-X HelloMob.
→ a57f1f9f Cristaleira / Bancada Lavabo / Mesa sem centros idênticos
→ Mesa sem fundo fantasma
```

## Artefatos

- `docs/evidence/hellomob-construction-rules.json`
- `src/lib/orcamentos-ia/bom-engine/hellomob-construction-rules.ts`
- `src/lib/orcamentos-ia/bom-engine/xray-geometry.ts`
- Opacidades: caixa `0.6` / frente `0.85` (`XRAY_BOX_OPACITY` / `XRAY_FRONT_OPACITY`)
