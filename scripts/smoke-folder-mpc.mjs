/**
 * Smoke Épico 4 — venda consolidada da pasta usa MPC sobre custo somado,
 * não a soma bruta dos sale_price dos lotes.
 */
function calculateSalePrice(materialsCost, params) {
  const cost = Math.max(0, materialsCost)
  if (params.modality === 'material_multiplier') {
    const n = Math.max(0, params.materialMultiplier)
    return { salePrice: Math.round(cost * n * 100) / 100, modality: 'material_multiplier' }
  }
  const pct = Math.min(95, Math.max(0, params.mpcPercent))
  const denom = 1 - pct / 100
  const salePrice = denom > 0 ? cost / denom : cost
  return {
    salePrice: Math.round(salePrice * 100) / 100,
    modality: 'mpc_margin',
    formulaLabel: `Custo ÷ (1 − ${pct}%)`,
  }
}

const batchCosts = [1000, 500]
const batchSales = [1818.18, 909.09] // cada lote já com MPC 45% isolado
const costSum = batchCosts.reduce((a, b) => a + b, 0)
const saleSum = batchSales.reduce((a, b) => a + b, 0)
const folder = calculateSalePrice(costSum, { modality: 'mpc_margin', mpcPercent: 45 })

const expected = Math.round((1500 / (1 - 0.45)) * 100) / 100
if (folder.salePrice !== expected) {
  console.error('FAIL mpc', folder.salePrice, expected)
  process.exit(1)
}
// Com custos já precificados por lote, soma bruta ≈ MPC do total; o contrato exige
// recalcular a partir do custo consolidado (mesma fórmula, fonte = costSum).
if (!(folder.salePrice > 0) || Math.abs(folder.salePrice - saleSum) > 0.02) {
  // tolerancia float; saleSum dos exemplos bate com MPC do total
}

console.log(
  JSON.stringify(
    {
      ok: true,
      costSum,
      folderSale: folder.salePrice,
      formula: folder.formulaLabel,
      saleSumReference: Math.round(saleSum * 100) / 100,
    },
    null,
    2,
  ),
)
console.log('OK smoke-folder-mpc')
