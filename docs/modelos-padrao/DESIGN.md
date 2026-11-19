# Modelos padrão do master — Design

> Requisitos: [`REQUIREMENTS.md`](./REQUIREMENTS.md) · Tarefas: [`TASKS.md`](./TASKS.md)

## 1. Estado atual (levantado em 2026-11-18, somente leitura)

| Dado | Banco novo (`vejugdspjfgfajdpfiht`) | Banco antigo (`zzqgtclvuetemzhqzhbq`, `emp_garbo`) |
|---|---|---|
| markup_categorias / produtos | 0 / 0 | 5 / 244 |
| markup_config / despesas / serviços / regras | 0 / 0 / 0 / 0 | 1 / 6 / 13 / 4 |
| slide templates / blocos | 0 / 0 | 1 / 11 |
| slide perguntas / opções / formas pgto | 0 / 0 / 0 | 9 / 43 / 3 |
| slide catálogo / scripts | 0 / 0 | 0 / 0 |
| contratos_modelos / variáveis | 1 (seed) / 17 | 4 / 17 |

Os quatro modelos de contrato no banco antigo são "Modelo Principal", "Contrato sem direito de imagem", "contrato otavio" e "Contrto sem e-mail" (o ativo).

**Consequências:**
- Os dados da Garbo **não vieram** na migração para o banco novo. Trazê-los é a primeira coisa a fazer (T03).
- 6 imagens dos blocos de slide apontam para o storage do projeto antigo. Elas precisam ser copiadas para o bucket `orcamento-slides` do novo, ou quebram quando o projeto antigo for desligado.
- A Garbo não tem timbrado (`timbrado_url` vazio).

## 2. Por que "empresa-modelo"

As telas de markup, slides e contratos são grandes. Refazê-las no /master criaria duas telas para manter iguais. Na empresa-modelo, o master edita nas telas reais, com o RLS de sempre, entrando em acesso total via `master_definir_empresa_ativa(empresa, false)`. A cópia é feita no banco, por funções SQL. Decisão registrada no ADR 0005.

## 3. Banco

### 3.1 Colunas e tabelas novas

- `"CRM-multi-empresas>empresas<"`:
  - `e_modelo boolean not null default false`
  - `segmento text` (livre: marcenaria, gráfica…)
- `plataforma_modelos`:
  - `id uuid pk`
  - `tipo text check in ('markup','slides','contrato','apresentacao','pontua')`
  - `empresa_modelo_id uuid fk empresas on delete cascade`
  - `ref_id uuid null`: id do `crm.contratos_modelos` no tipo contrato; NULL nos demais
  - `nome`, `descricao`, `publicado bool default false`, `versao int default 1`, `atualizado_em`
  - unique `(empresa_modelo_id, tipo, coalesce(ref_id, '0000…'))`
- `plataforma_plano_modelos(plano_id fk, modelo_id fk, pk(plano_id, modelo_id))`
- `plataforma_modelo_entregas(id, modelo_id fk, empresa_id fk, versao, entregue_em default now(), entregue_por uuid, resumo jsonb)`
- RLS das três tabelas: `plataforma_master using (app_is_master())`, como as demais `plataforma_*` (`20261117160000…:223-231`).
- Listas do master (`master_listar_empresas`, `master_resumo_empresas`, faturamento) passam a filtrar `not e_modelo`. A empresa-modelo também fica fora do job de cobrança, porque não tem assinatura.

### 3.2 Funções de cópia (definer do **postgres**, `revoke all from public, anon, authenticated`)

São funções do postgres porque `app_empresa_atual()` ignora o GUC quando há `auth.uid()`, e o master está fora de inspeção. Por isso toda linha leva **`empresa_id` explícito**. A primeira linha de cada função é `perform app_set_empresa_ctx(destino)`, para os triggers.

**Regra geral:** só acrescenta; a chave natural decide o que "já existe"; os ids são remapeados por tabela temporária ou CTE.

| Função | Chaves naturais / regras |
|---|---|
| `plataforma_copiar_markup(origem, destino)` | categorias `(slug, coalesce(subcategoria,''))`, com mapa que inclui as já existentes. Produtos `(categoria_dest, nome, coalesce(variacao,''))`. `markup_config` só se o destino não tiver linha, com `timbrado_url = null`. Despesas e serviços por `nome`. Regras por `tipo_movel` entre as ativas. |
| `plataforma_copiar_slides(origem, destino)` | Template e blocos só se o destino não tiver template, com `logo_url`/`fundo_url = null`; o `config` dos blocos é copiado como está (fotos mantêm a URL). Perguntas por `label`, opções por `(pergunta_dest, valor)`; se `valor` for uuid de item do catálogo da origem, troca pelo id do item no destino. Catálogo `(categoria, titulo)`, scripts `titulo`, formas `(tipo, nome)`. |
| `plataforma_copiar_contrato(modelo_id, destino)` | Variáveis citadas no `conteudo` (regex `{{nome}}` e `{{#se nome}}`) que existam na origem e faltem no destino entram por `nome`; as que já existem ficam como estão. O modelo é inserido com `nome`; se o nome já existir, usa " (v2)", " (v3)"… `ativo = true` só se o destino não tiver modelo ativo. |
| `plataforma_copiar_apresentacao(origem, destino)` | `crm.apresentacao_conteudo.conteudo`, só se o destino não tiver linha. |
| `plataforma_copiar_pontua(origem, destino)` | `apresentacao_conteudo.pontua` só se estiver vazio no destino, mais o `percentual_padrao` do `config_pontua_garbo`. |

Cada função devolve um `jsonb` de resumo (ex.: `{"categorias":5,"produtos":244,"ignorados":0}`), que é gravado em `plataforma_modelo_entregas.resumo`.

### 3.3 Orquestração e RPCs

- `plataforma_aplicar_modelo(modelo_id, empresa_id) → jsonb`: escolhe a função pelo `tipo` e registra a entrega. Recusa destino `e_modelo` e destino igual à origem.
- `master_criar_empresa_modelo(nome, slug, segmento, importar_de uuid default null) → uuid`: cria a empresa com `e_modelo = true` e roda `plataforma_seed_empresa`. Se `importar_de` vier, copia os 5 tipos daquela empresa e cria as linhas de `plataforma_modelos`: uma por tipo de pacote e uma por modelo de contrato, todas `publicado = false`.
- `plataforma_sincronizar_modelos(empresa_modelo)` (interna; chamada por `master_listar_modelos` e `master_criar_empresa_modelo`): garante as linhas dos pacotes e dos contratos; contrato apagado sai do catálogo se nunca foi entregue, senão é despublicado.
- `master_listar_modelos(empresa_modelo?)`: catálogo com contagem, nº de entregas e planos. `master_listar_entregas(modelo?)`, `master_listar_empresas_modelo()`, `master_atualizar_empresa_modelo(...)`.
- `master_publicar_modelo(modelo_id, publicado bool)`
- `master_salvar_modelos_plano(plano_id, modelos uuid[])`
- `master_enviar_modelo(modelo_id, empresas uuid[]) → jsonb[]`
- Todas as `master_*` começam com `app_assert_master()` e são `grant execute to authenticated`.
- `master_criar_empresa`: depois de inserir a empresa e **antes** de `plataforma_seed_empresa`, aplica os modelos publicados do plano (`p_plano_id`). Assim `crm_seed_contrato_padrao`, que só age em empresa sem modelo, não duplica o contrato quando o plano já trouxe um.

## 4. Apresentação e Pontua

- Tabela de tenant `crm.apresentacao_conteudo`:
  - colunas: `id`, `empresa_id unique`, `conteudo jsonb`, `pontua jsonb`, `atualizado_em`, `atualizado_por` (o link público usa o `slug` da empresa; não há slug próprio);
  - trigger `aaa_tenant_fill`, policy RESTRICTIVE `tenant_isolamento`, policies `tenant_master_leitura_{ins,upd,del}`, `tenant_definer`.
- Leitura pública via RPC definer `apresentacao_publica(slug)`, que devolve só o conteúdo e o nome e logo da empresa.
- O formato do `conteudo` espelha `garbo-apresentacao-content.ts`: hero, seções, cubo/projetos, fechamento, contatos, CTA e tema. O seed da Garbo nasce desses valores.
- Os componentes `GarboApresentacao*` recebem o conteúdo por um hook `useApresentacaoConteudo()`, com as constantes atuais como fallback. As strings "Garbo" fixas no JSX viram campos.
- `GarboParceriaFormOverlay`: o `empresaId` deixa de ser constante e passa a vir da empresa dona do conteúdo.
- Editor `/marketing/apresentacao-interna/editar`: formulário à esquerda, prévia ao vivo à direita, upload para o storage e aba Pontua.

## 5. Front do master

- `src/master/pages/Modelos.tsx` + item "Modelos" no `MasterLayout`.
  - Lista as empresas-modelo (cartão com segmento e botão "Entrar para editar", que abre `EntrarEmpresaDialog` com acesso total sugerido).
  - Catálogo por tipo, com contagens.
  - Chave Publicar.
  - "Enviar para…": escolhe empresas e mostra o resumo devolvido.
  - Histórico de entregas.
- `Planos.tsx`: painel "Modelos que este plano recebe" com checkboxes dos publicados.
- Hooks em `useMaster.ts` (`rpc<T>()`, chaves `['master','modelos',…]`, invalidação por `useInvalidarMaster`).
- Visual: `MasterPage`, `Painel`, `Numeros`, `Vazio` e tokens `--m-*`. Sem cores novas.

## 6. Riscos

- **`compose-markup-ia` lê markup sem filtro de empresa** (service role). Com duas empresas tendo catálogo, a IA mistura dados. A correção é a T02, antes de qualquer cópia.
- **Imagens no storage antigo:** precisam ser copiadas na T03, antes de o projeto antigo ser desligado.
- **Fotos compartilhadas:** a empresa que recebe fotos de catálogo ou galeria aponta para o arquivo do modelo. Se o master apagar o arquivo no modelo, a foto some nas cópias. Mitigação: o editor do modelo avisa antes de excluir uma imagem.
- **Linha única sem unique** (`markup_config`, template de slides): a cópia nunca cria uma segunda linha.
- **Tabela de tenant nova** (`apresentacao_conteudo`) precisa das policies de leitura do master. Há teste para isso.
