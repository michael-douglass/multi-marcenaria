# IA no card lead — requisitos

1. **Função por plano/empresa:** "IA no card lead" (`iaCardLead`) no grupo "Funções do CRM" de `/master/planos` e na aba Páginas de `EmpresaDetalhe`. Desligada: some a aba IA, o item no "Ir para…"/busca, o ícone do dock e o servidor recusa.
2. **Sem Análise visual:** a subaba, o chat Íris Sky, a Memória e as edge functions próprias saem.
3. **Motor no master:** chave, modelos de visão/imagem e prompts da Renderização em `/master/modelos`.
4. **Tokens:** consumo por empresa visível ao master; limite mensal por plano com sobreposição por empresa; bloqueio duro.
5. **Reparo visual** do card do lead ao final (`/reparo-visual`).

## Decisões
D1 Markup IA perde o contexto análise/conhecimento em leads novos. D2 empresa sem plano é recusada. D3 plano novo nasce com a função bloqueada. D4 renders salvos continuam visíveis. D5 limite em tokens totais por mês (America/Sao_Paulo); dall-e-2 usa valor fixo por imagem. D6 a empresa só vê o aviso de limite. D7 chave própria da empresa segue para markup/contrato. D8 código legado não roteado: só tira a chamada a `analyze-lead-photos`.

## Critérios
Ver `TASKS.md` (aceite por tarefa) e a verificação ponta a ponta em `DESIGN.md`.
