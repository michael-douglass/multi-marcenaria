# Modelo de contrato pré-cadastrado — Requisitos

> Origem: plano aprovado "Fase K — modelo de contrato pré-cadastrado em toda marcenaria".
> Desenho técnico em [`DESIGN.md`](./DESIGN.md); execução em [`TASKS.md`](./TASKS.md).
> Depende do projeto [`docs/identidade-empresa/`](../identidade-empresa/) (cadastro da empresa em `/profile` e variáveis `{{empresa_*}}`).

## 1. Contexto

Hoje nenhuma marcenaria nasce com modelo de contrato nem com campos: `/contratos/configuracoes` mostra só "Criar primeiro modelo". O modelo que a Garbo usa no banco antigo ("Contrto sem e-mail") tem a contratada fixa no texto (nome, CNPJ, telefone, representante com CPF, endereço, chave PIX, foro e cidade), percentuais 60/40, garantia, tolerância e prazo de ajustes fixos, e os valores por extenso digitados à mão em campos com nomes errados.

O objetivo é que **toda** empresa já tenha um modelo pronto, sem a marca Garbo, preenchido com o cadastro da própria empresa, e que as partes que mudam de contrato para contrato sejam variáveis com valor padrão.

## 2. Decisões do usuário (fechadas)

| # | Decisão |
|---|---|
| D1 | O **representante legal** (nome, CPF, qualificação) fica no cadastro da empresa, em Perfil → Dados da empresa. |
| D2 | Viram variáveis **com valor padrão**, ajustáveis em cada contrato: percentual de entrada (o sistema calcula entrada, saldo e os textos por extenso), garantia, tolerância, prazo de ajustes, foro, chave PIX e incluir/retirar a cláusula de imagem. |
| D3 | O texto-base é o modelo ativo da Garbo, com as cláusulas **na íntegra**; só trocam os trechos fixos da contratada e os valores listados em D2. |
| D4 | Empresa que **já tem modelo** não é tocada pelo seed nem pelo backfill. |

## 3. Requisitos funcionais

- **RF01 — Modelo semeado.** Toda empresa sem nenhum modelo recebe o modelo "Contrato padrão — móveis planejados" (ativo) e os 18 campos do DESIGN §3. Vale para empresas novas (`plataforma_seed_empresa`) e, por backfill, para as que já existem.
- **RF02 — Representante legal.** O admin preenche nome, CPF (validado, guardado só com dígitos) e qualificação do representante em `/profile`. Os dados entram no contrato por `{{empresa_representante_nome}}`, `{{empresa_representante_cpf}}` e `{{empresa_representante_qualificacao}}`.
- **RF03 — Valor padrão por campo.** Cada campo pode ter um valor padrão, que pode citar `{{empresa_*}}` (ex.: chave PIX = `{{empresa_cnpj}}`). No contrato novo, os campos vazios já vêm com o padrão resolvido.
- **RF04 — Tipos novos.** Além de texto, data, valor e CPF: **Número** e **Sim/Não** (Switch no formulário).
- **RF05 — Variáveis calculadas.** Nunca pedidas ao usuário:
  - `{{X_extenso}}` para todo campo X do tipo valor ou número;
  - com `valor_total` e `percentual_entrada`: `valor_entrada`, `valor_saldo`, `percentual_saldo` e seus `_extenso`, sem erro de arredondamento (saldo = total − entrada, em centavos).
- **RF06 — Blocos condicionais.** `{{#se nome}}…{{/se}}` mantém o trecho quando o campo vale "sim" e o remove (junto com a quebra de linha) quando vale "não". Retirar a cláusula de imagem (item 4.4) não deixa buraco na numeração.
- **RF07 — Só os campos do modelo.** O formulário do contrato novo mostra só os campos usados no modelo escolhido (mais o CPF fixo da assinatura). Os obrigatórios valem só para os campos exibidos. As calculadas aparecem como leitura.
- **RF08 — Editor.** A aba Campos ganha "Valor padrão" e os tipos Número e Sim/Não; o painel "Variáveis disponíveis" lista as calculadas e explica o `{{#se …}}`. Nomes reservados (`empresa_*`, calculadas, `*_extenso` de campos valor/número) não podem virar campo manual.
- **RF09 — Restaurar modelo padrão.** Quem apagou todos os modelos vê o botão "Restaurar modelo padrão", que recria o modelo e os campos que faltarem.
- **RF10 — Compatibilidade.** Modelos antigos (sem as variáveis novas) continuam funcionando como hoje, inclusive a heurística `sugerirCamposPorExtenso`.

## 4. Requisitos não funcionais

- **RNF01 — Isolamento multi-empresa.** Tudo por `empresa_id` + RLS. O front não envia `empresa_id`. `crm_seed_contrato_padrao` segue o padrão de `crm_seed_pipeline_padrao` (definer, `app_set_empresa_ctx`, sem execute para public/anon/authenticated).
- **RNF02 — Master em somente leitura.** `empresa_atualizar_dados` continua recusando escrita em inspeção somente leitura.
- **RNF03 — Idempotência.** Rodar o seed duas vezes não duplica nada (`unique (empresa_id, nome)` em `crm.contratos_variaveis`).
- **RNF04 — Sem marca fixa.** O texto padrão não contém "Garbo", "58.838.942", "Fábio", "Boa Esperança" nem telefone fixo.
- **RNF05 — Verificação.** `pnpm build` sem erros a cada tarefa; `scripts/test-contrato-padrao.mjs` e `test-plataforma.sql` (sempre rollback). UI só com Tailwind, `lucide-react` e `src/components/ui`.
- **RNF06 — Banco antigo.** O projeto `zzqgtclvuetemzhqzhbq` é só leitura.
- **RNF07 — Par TS ↔ SQL.** O texto e os campos do modelo existem em `src/lib/contrato-padrao.ts` e na migration; ao mudar um, mude o outro.

## 5. Fora do escopo

- Migrar os contratos já emitidos no banco antigo.
- Corrigir a recursão de policies na tabela de empresas (TS01 do projeto identidade).
- Deploy da edge function `compose-contrato-ia` (se o prompt mudar, só com autorização).
