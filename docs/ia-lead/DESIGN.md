# IA no card lead — desenho

Plano completo e tarefas: `TASKS.md`. ADR: `docs/decisions/0007-motor-ia-global-do-master.md`.

## Banco (todas `plataforma_*`, sem `aaa_tenant_fill`/`tenant_isolamento`)
- `plataforma_ia_motor` (singleton): `ativo`, `render_ativo`, `render_ambiente_ativo`, `vision_model`, `image_model`, 4 prompts (null = padrão do código), `tokens_por_imagem_fixa`. Policy `plataforma_master`.
- `plataforma_ia_segredos`: RLS sem policy; `revoke all` de public/anon/authenticated. Só service role lê; só RPCs `master_ia_motor_*` gravam.
- `plataforma_ia_uso`, `plataforma_ia_precos`, `plataforma_planos.ia_tokens_limite_mensal`, `plataforma_empresa_ia`, RPC `plataforma_ia_cota` e `plataforma_ia_registrar_uso` (só service role).
- `app_ia_card_lead_status()` para o front da empresa (sem modelo, prompt, chave ou números).

## Edge functions
`_shared/ia-card-lead.ts`: `autorizarIaCardLead` → `checarCota` → `registrarUso`. Render conta como escrita (recusa em somente leitura). `empresa_id` só vem do chamador.

## Verificação ponta a ponta
1. Master liga a função num plano, define limite e cadastra o motor.
2. Usuário recarrega, abre o lead e usa render, edição e ambiente.
3. Master vê o consumo; baixa o limite e o banner de cota aparece.
4. Desliga a função: a aba some e a URL direta cai em "info". Inspeção somente leitura devolve 403 limpo.
