# Página Pontua e sistema sem "Garbo" — Tarefas

> Modo pair-to-peer: o usuário autorizou executar todas as tarefas em sequência (2026-11-19).
> Requisitos: [`REQUIREMENTS.md`](./REQUIREMENTS.md) · Design: [`DESIGN.md`](./DESIGN.md).
>
> **Validação base**
> - `pnpm exec tsc --noEmit -p tsconfig.app.json`: os erros antigos são reportados, não escondidos (209 antes e depois).
> - `pnpm build`.
> - Banco: `node --env-file=.env scripts/multi-empresa/q.mjs --write -f scripts/multi-empresa/test-plataforma.sql` (sempre rollback). T2/T4 falham se o master estiver em inspeção no navegador (estado do ambiente, não do código).
> - API: `test-isolamento.mjs` e `scripts/modelos-padrao/test-modelos-api.mjs`.

- [x] **T01 — Docs.** REQUIREMENTS, DESIGN, TASKS e ADR 0006.
- [x] **T02 — Página Pontua.**
  - Rota `/marketing/pontua` (`PontuaPage.tsx`).
  - Modo `somentePontua` em `ApresentacaoEmpresa`: navegação Pontua / Como funciona / Painel, sem formulário de parceria.
  - O h2 usa `pontua.title`, com padrão "Programa de pontuação para parceiros".
  - No menu aparece "Pontua"; `aplicarNomePrograma` foi removido.
  - Id de página `pontua`. Migration `20261119100000` troca o id nos planos e nas empresas e remove o `title` salvo.
  - Validação: `check-catalogo` e `check-paginas-visiveis` (1085, 0 falhas), build, typecheck sem erro novo e conferência no navegador.
- [x] **T03 — Link público do Pontua.**
  - `/apresentacao/:slug/pontua`; o botão "Copiar link" da página Pontua copia esse endereço.
  - Sem slug padrão; `/marketing/apresentacao-empresa` passa a levar para `/marketing/apresentacao-interna`.
  - Conferido no navegador (`/apresentacao/garbo/pontua`).
- [x] **T04 — Editor do Pontua.**
  - `/marketing/pontua/editar`: título editável, prévia só do Pontua, link público.
  - `editor-campos.tsx` compartilhado entre os editores.
  - Salvamento parcial (`useSalvarApresentacaoConteudo`). O editor da apresentação ficou sem a aba Pontua.
  - O "Editar" do master aponta para o editor novo.
- [x] **T05 — Empresa-modelo sem Garbo.**
  - Migration `20261119100100`:
    - apresentação e Pontua neutros (JSON gerado por `scripts/marca-neutra/gerar-conteudo-neutro.mjs`);
    - contratos com `{{empresa_*}}`, sem o CNPJ e o CPF de cliente;
    - texto da garantia;
    - pasta `/imagens/apresentacao/`.
  - `scripts/marca-neutra/mover-imagens-marca.mjs`:
    - as fotos com o logo saíram de `public/` e foram para o storage da empresa dona;
    - 12 blocos de slide foram para `template/crm/blocos/<id>/`, e os arquivos antigos foram apagados.
  - O diálogo de nova empresa-modelo não tem mais origem padrão.
  - Teste T56.
- [x] **T06 — Marca neutra.**
  - "Gestão" no manifesto, no título e em `APP_SYSTEM_NAME`.
  - Monograma (`scripts/marca-neutra/gerar-icones.mjs`) no favicon, nos ícones do PWA e em `MARCA_PADRAO_LOGO`.
  - A aba do navegador mostra o nome da empresa.
  - 13 textos fixos substituídos por `empresaDocumento()`/`APP_SYSTEM_NAME`.
  - A logo da Garbo foi copiada do projeto antigo para o novo (`scripts/marca-neutra/copiar-logos-antigos.mjs`).
- [x] **T07 — Outros textos visíveis.**
  - Rodapé de orçamento com o nome da empresa, Prancha, Precificação, instruções, cadastro público, Admin, Clientes, subtítulos e nomes de arquivo exportado.
  - Edge functions: `rep-gerar-comprovante` (nome da empresa) e prompt de `orcamentos-ia-chat`.
  - O recibo reconhece o nome da empresa.
- [x] **T08 — Apresentação sem Garbo no código.**
  - `CONTEUDO_GARBO`, `PONTUA_GARBO`, o UUID fixo, o Instagram e o telefone saíram do código; os padrões neutros passaram a ser próprios.
  - Arquivos `Apresentacao*` / `apresentacao-*`; id do DOM `#pontua`.
- [x] **T09 — Banco e edge sem Garbo.**
  - Migration `20261119100200`, gerada por `scripts/marca-neutra/gerar-migration-banco.mjs`: 4 tabelas, 6 colunas, 12 constraints, 26 índices, 2 triggers, 4 nomes e 15 corpos de função.
  - O recibo usa o nome da empresa; os valores gravados passaram a ser `'Pontua'`/`'Lead'`.
  - `20261119100300`: campo "Pontua", com o trigger de proteção desligado só nesse passo.
  - Edge `_shared/pontua-lead.ts`. Teste T57.
- [x] **T10 — Pontua/financeiro sem Garbo no código.** `scripts/marca-neutra/renomear-codigo.mjs` alterou 137 arquivos e renomeou 44, sem colisões. Arquivos mortos apagados.
- [x] **T11 — Marca, carregamento e infraestrutura.** `BrandLoader`/`LoadingBrand`, classes e chaves `app-*` e caches `app-google-fonts-*`; os assets antigos foram apagados.
- [x] **T12 — Varredura final.**
  - `grep -ri garbo src supabase/functions public index.html vite.config.ts netlify.toml` → 0.
  - Banco: 0 objetos e 0 corpos de função com o nome.
  - `importar-empresa-antiga.mjs`; CLAUDE.md e structure.md atualizados.
  - Suítes: SQL até T57, isolamento 27/27, modelos 20/20, build e catálogo.

## Pendências fora do código
- **Deploy** das edge functions, junto com o front: `create-user-admin`, `register-public`, `rep-gerar-comprovante`, `orcamentos-ia-chat` e `compose-markup-ia`.
- **Dados da empresa Garbo** (cliente): o nome, o slug `garbo`, a apresentação própria e os contratos dela continuam, porque são dados da empresa.
- **Fora do escopo:** `scripts/` (ferramentas de dev, com dados históricos) e `docs/` antigos ainda citam o nome; as migrations já aplicadas são histórico.

## Ajustes (2026-11-19, segunda rodada)
- [x] **A01 — Administração CRM como menu próprio.**
  - Deixou de ficar dentro de Marketing: agora é item principal (`adminCrmGrupo`, `ADMIN_CRM_CHILDREN`) e abre sozinho nas rotas `/admin*`.
  - No catálogo do master continua em Geral › Administração.
  - `check-catalogo` e `check-paginas-visiveis`: 0 falhas.
- [x] **A02 — Logo da empresa em todo lugar.**
  - Fundo do Pontua (`PontuaPointsScene`): logo do conteúdo (link público usa `apresentacao_publica.logo_url`) ou logo da empresa ativa.
  - Também usam essa logo as auras 3D (papel, busca, leads, projetos, produção, pipeline, cobranças, funcionários, financeiro Pontua) e os carregamentos (`BrandLoader`, `LoadingBrand`).
  - Sem logo cadastrada, entra o monograma padrão. O login segue com o monograma, porque ainda não se sabe a empresa.
- [x] **A03 — Perfil do master em inspeção.**
  - O cadastro do master fica na empresa de origem e o isolamento o esconde nas outras. `useCurrentUserProfile` agora monta o perfil a partir da conta logada (papel admin) quando é master.
- [x] **A04 — Banner do portal do parceiro só nos modelos.**
  - O card em `/admin/marca` só aparece na empresa-modelo.
  - Gravação pela RPC `empresa_atualizar_banners`, que recusa empresa comum. Antes o UPDATE direto falhava e o front nunca lia os banners.
  - Leitura por `app_empresa_portal()` (hook `useEmpresaPortal`), usada também pelo portal do prestador.
  - O pacote Pontua (`plataforma_copiar_pontua`) entrega os banners só se o destino não tiver nenhum.
  - Migration `20261119110000`. Teste T58.
