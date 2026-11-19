# 0005 — Modelos padrão mantidos em "empresas-modelo" e copiados por SQL

**Status:** Aceita
**Data:** 2026-11-18

## Contexto
O master precisa entregar empresas novas já configuradas: tabela de markup, slides de orçamento, contratos, apresentação para arquitetos e Pontua. Também precisa escolher o que cada plano recebe. As telas que editam esses dados são grandes e vivem no lado da empresa. Recriá-las no console master criaria duas telas para manter iguais. A empresa que recebe a cópia precisa poder editá-la sem afetar o modelo nem as outras empresas.

## Decisão
Os modelos são dados de **empresas especiais** (`empresas.e_modelo = true`, com `segmento`). O master as edita nas telas normais, entrando por inspeção em acesso total. Funções SQL (definer do postgres, `empresa_id` explícito) copiam esses dados para a empresa destino, **só acrescentando**: chaves naturais e ids remapeados. Um catálogo em `plataforma_modelos` controla o que está publicado, o que cada plano recebe (`plataforma_plano_modelos`) e o que foi entregue (`plataforma_modelo_entregas`).

## Consequências
- Nenhuma tela de edição é duplicada. Qualquer melhoria nas telas vale para os modelos.
- As cópias são independentes: mudar o modelo não propaga, e o reenvio só acrescenta.
- Cada função de cópia precisa conhecer as FKs e as chaves naturais do seu módulo. Tabela nova num módulo copiável exige atualizar a função.
- As empresas-modelo precisam ser excluídas das listas, KPIs e cobranças do master.
- As fotos copiadas apontam para os arquivos da empresa-modelo (URLs públicas compartilhadas). Logo, fundo e timbrado não são copiados.
