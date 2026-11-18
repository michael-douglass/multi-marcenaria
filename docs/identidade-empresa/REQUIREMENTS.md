# Identidade da marcenaria — Requisitos

> Origem: plano aprovado "Identidade da marcenaria (logo, CNPJ + Receita, nome fantasia, Pontua {nome})".
> Desenho técnico em [`DESIGN.md`](./DESIGN.md); execução em [`TASKS.md`](./TASKS.md).

## 1. Contexto

O sistema mostra a marca GARBO fixa: logo do menu (`src/components/Logo.tsx` → `/imagens/identidade-visual-garbo.png`), "GARBO MOVELARIA" em vários PDFs e "Pontua Garbo" nas telas do programa de pontos. Com o SaaS multi-empresa (ver `docs/multi-empresa/`), cada marcenaria precisa da própria identidade, cadastrada pelo admin da empresa e usada no sistema todo.

## 2. Decisões do usuário (fechadas)

| # | Decisão |
|---|---|
| D1 | O **nome fantasia** reaproveita a coluna `empresas.nome` (não cria coluna nova). |
| D2 | A seção "Dados da empresa" fica no **/profile**, visível **só para admin**. `/admin/marca` reaproveita o mesmo componente. |
| D3 | "Pontua" muda em **todos os textos visíveis**. Chaves gravadas no banco, ids, query keys, slugs de rota e nomes de arquivo ficam como estão. |
| D4 | O CNPJ entra em slides, contratos e PDFs. Configurações próprias de recibo, ponto (REP) e RH continuam valendo quando preenchidas; o cadastro da empresa vira o **valor padrão**. |

## 3. Requisitos funcionais

- **RF01 — Cadastro da empresa no /profile (admin).** Seção com 3 blocos: logo (upload, preview, remover, cor), CNPJ (com máscara) e dados cadastrais (razão social, nome fantasia, CEP, logradouro, número, complemento, bairro, cidade, UF, telefone, e-mail). Um botão "Salvar dados da empresa" grava tudo.
- **RF02 — Consulta à Receita.** Ao completar um CNPJ válido (14 dígitos com dígitos verificadores corretos), o sistema consulta a Receita (BrasilAPI, com fallback `publica.cnpj.ws`) e **preenche** os campos sem gravar. O admin revisa e salva. Botão "Buscar na Receita" refaz a consulta. Se a situação cadastral for diferente de ATIVA, mostra aviso. Erro da API vira toast e o preenchimento continua manual. Sem nome fantasia na Receita, usa a razão social.
- **RF03 — CNPJ normalizado.** O banco guarda só os 14 dígitos; a máscara `00.000.000/0000-00` é aplicada na exibição. CNPJs existentes são normalizados.
- **RF04 — Logo dinâmica.** A logo do menu (sidebar 72px e recolhida), `NavigationHeader`, `ForaDoHorario` e `CrmModuloPlaceholder` usa a logo da empresa, com fallback para a logo GARBO e `alt` = nome fantasia. Muda sem recarregar a página após salvar.
- **RF05 — Slides do orçamento.** Capa/investimento mostram razão social e CNPJ da empresa, inclusive na página pública `/orcamento/:schema/:id` (sem sessão). O PDF exportado é refeito quando CNPJ, razão social ou logo mudam.
- **RF06 — Contratos.** Cabeçalho e assinatura usam o CNPJ formatado. Novas variáveis automáticas: `{{empresa_nome}}`, `{{empresa_razao_social}}`, `{{empresa_cnpj}}`, `{{empresa_endereco}}`, `{{empresa_telefone}}`, `{{empresa_email}}` — aparecem na lista do editor e não são pedidas ao usuário no contrato novo. A IA de contratos usa o nome da empresa nos prompts.
- **RF07 — PDFs e recibos.** Todo PDF/recibo com "GARBO MOVELARIA" fixo passa a usar a empresa. Prioridade: config própria (`movelaria_recibo_config`, `movelaria_rep_config`, RH) → cadastro da empresa → nome genérico. REP/AFD usa CNPJ só com dígitos.
- **RF08 — "Pontua {nome fantasia}".** O programa de pontos aparece como "Pontua {nome fantasia}" no menu, busca, página, apresentação pública (`document.title`), modal do lead, badges, admin, financeiro, toasts, PDFs e nota automática do lead. O catálogo do master continua "Pontua (programa de pontos)".
- **RF09 — Uma fonte de edição.** "Dados da contratada" em `ContratosConfigPage` passa a ser somente leitura, com link "Editar em Perfil".

## 4. Requisitos não funcionais

- **RNF01 — Isolamento multi-empresa.** Nada muda no isolamento por `empresa_id` + RLS. `test-isolamento.mjs` continua passando.
- **RNF02 — Master em somente leitura.** Em inspeção somente leitura, salvar os dados da empresa é recusado pelo banco.
- **RNF03 — Compatibilidade de dados.** Valores gravados como `'Pontua Garbo'` (`PONTUA_GARBO_CAMPO_NOME`, `PONTUA_GARBO_LEAD_ORIGEM`, `.ilike("nome","Pontua Garbo")`) não mudam; só a exibição é mapeada. Leads antigos continuam reconhecidos (badge e cor).
- **RNF04 — Telas sem sessão.** Login, loaders de boot, PWA, favicon e texturas WebGL "Aura" continuam GARBO.
- **RNF05 — Verificação.** `pnpm build` sem erros a cada tarefa. UI só com Tailwind, ícones `lucide-react`, primitivos de `src/components/ui`. Sem `any` sem justificativa.
- **RNF06 — Banco compartilhado.** `pnpm migrate` só com autorização explícita do usuário.

## 5. Bugs que entram no escopo

| Bug | Onde | Correção |
|---|---|---|
| B1 | `useEmpresaBranding` chama `trocarEmpresa()` no `onSuccess` — erro para não-master (chama `master_definir_empresa_ativa`), reload para o master | Trocar por `recarregarEmpresa()` (T04) |
| B2 | `ConfiguracaoMarca.tsx:19` lê o CNPJ só na montagem; campo vazio se a empresa carrega depois | Substituído pelo `EmpresaDadosForm` (T06) |
| B3 | `orcamento_publico_obter` não devolve dados da empresa; página pública sem CNPJ/razão social | Chave `empresa` no RPC (T01) + prop em `EmpresaDadosLegais` (T08) |
| B4 | `orcamento-slide-export-cache.ts` não considera CNPJ nem logo no fingerprint | Incluir no fingerprint (T08) |

## 6. Fora do escopo

- Login, boot, PWA, favicon e Aura (RNF04).
- Renomear chaves, rotas, ids e arquivos `pontua-garbo`/`pontuaGarbo` (D3).
- **Proposta de segurança (tarefa separada, TS01):** a policy `me_empresas_contratos_timbrado_update` permite que o **vendedor** atualize qualquer coluna da empresa. Sugestão: restringir via RPC `empresa_atualizar_dados` só para admin.

## 7. Critérios de aceite globais (verificação manual, `pnpm dev` :3000, admin de empresa de teste)

1. /profile → "Dados da empresa" → digitar o CNPJ → campos preenchidos → enviar logo → salvar.
2. A logo de 72px do menu muda sem recarregar. Vendedor não vê a seção.
3. /orcamento-slides → capa/investimento com razão social e CNPJ; link público idem; PDF exportado de novo reflete a mudança.
4. Contrato novo → cabeçalho e assinatura com CNPJ; `{{empresa_cnpj}}` no modelo é preenchida.
5. Recibo/comprovante de caixa → nome e CNPJ da empresa quando a config própria está vazia.
6. /marketing/pontua-garbo e menu → "Pontua {nome fantasia}"; lead com origem Pontua continua reconhecido.
7. Master em inspeção somente leitura → salvar é recusado.
