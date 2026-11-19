# Modelo de contrato pré-cadastrado — Design técnico

> Requisitos em [`REQUIREMENTS.md`](./REQUIREMENTS.md); tarefas em [`TASKS.md`](./TASKS.md).
> Contexto: `docs/identidade-empresa/DESIGN.md` (cadastro da empresa, `empresa_atualizar_dados`) e `docs/multi-empresa/DESIGN.md` §1.1.

## 1. O que já existe (reaproveitar)

| Peça | Onde |
|---|---|
| Cadastro da empresa no Perfil | `src/components/admin/EmpresaDadosForm.tsx` → RPC `empresa_atualizar_dados(jsonb)` (`20261118120100_empresa_atualizar_dados.sql`) |
| Empresa ativa | `app_minha_empresa()` (`20261118120000_empresa_dados_cadastrais.sql`), `src/hooks/useEmpresaAtiva.ts` (`EmpresaAtiva`, `mapEmpresa`) |
| Identidade pronta para documentos | `src/lib/empresa-identidade.ts` (`montarEmpresaIdentidade`), `src/hooks/useEmpresaIdentidade.ts` |
| Variáveis `{{empresa_*}}` | `VARIAVEIS_EMPRESA` / `valoresVariaveisEmpresa` em `src/lib/contratos-print.ts` |
| Montagem do texto | `buildConteudoContrato` em `src/lib/contrato-rascunho.ts` (usado por `NovoContratoPage`, `ContratoVisualizarDialog`) e a versão legada em `src/lib/crm-contratos.ts` (`src/pages/crm/ContratosPage.tsx`) |
| Por extenso | `src/lib/valor-monetario-extenso.ts` ↔ `supabase/functions/_shared/valor-monetario-extenso.ts` (par) |
| Seed de CRM por empresa | `crm_seed_pipeline_padrao` + `plataforma_seed_empresa` (`20261118110000_crm_pipeline_padrao.sql`) |
| Tabelas | `crm.contratos_modelos (id, nome, conteudo, ativo, updated_at, empresa_id)`, `crm.contratos_variaveis (id, nome, label, tipo, obrigatorio, ordem, created_at, mostrar_no_link_publico, empresa_id)` |

## 2. Estado atual do banco (consulta da C01, 2026-11-18)

Banco **novo** (`vejugdspjfgfajdpfiht`), via `node --env-file=.env scripts/multi-empresa/q.mjs` (sessão read-only):

| Empresa | `contratos_modelos` | ativos | `contratos_variaveis` |
|---|---|---|---|
| Garbo Movelaria (`2c196e67-dd26-4e1c-839d-4d234f3a3dfd`) | 0 | 0 | 1 (`cpf`, "CPF do Contratante", tipo `cpf`, obrigatório, ordem −1, fora do link) |

- Há **uma** empresa no banco. Total geral: 0 modelos, 1 variável; nenhuma linha sem `empresa_id`.
- **Duplicatas `(empresa_id, nome)`: nenhuma.** O `unique` entra sem limpeza (a migration ainda remove duplicatas de `cpf` por segurança, mantendo a mais antiga).
- Constraints de `crm.contratos_variaveis`: `contratos_variaveis_pkey`, **`contratos_variaveis_tipo_check`** = `CHECK (tipo = ANY (ARRAY['texto','data','valor','cpf']))`, `tnt_513e2b0015_fk` (FK `empresa_id`, `on delete cascade`).
- `public.app_minha_empresa()` → `TABLE(id uuid, nome text, slug text, status text, ativo boolean, logo_url text, cor_primaria text, cnpj text, razao_social text, is_master boolean, paginas_bloqueadas text[], em_inspecao boolean, inspecao_somente_leitura boolean, cep text, logradouro text, numero text, complemento text, bairro text, cidade text, uf text, telefone text, email text)`. Owner `postgres`, `security definer`, execute para `authenticated`, `service_role`, `app_tenant_definer`. **Retorno `table`**: acrescentar colunas muda o tipo, então é `drop` + `create` e regrant.
- `public.empresa_atualizar_dados(p_dados jsonb)` → `void`. Owner `postgres`, `security definer`, execute para `authenticated` (+ `service_role`, `app_tenant_definer`). Assinatura e retorno não mudam: `create or replace` preserva os grants.
- `crm_seed_pipeline_padrao(uuid)` e `plataforma_seed_empresa(uuid)` → `void`, definer, sem execute para `authenticated`.

Conclusão: nada contradiz o plano. Como a Garbo **não tem modelo** no banco novo, o backfill vai semear o modelo padrão nela também (o `cpf` existente é mantido pelo `on conflict do nothing`).

Banco **antigo** (`zzqgtclvuetemzhqzhbq`, só leitura): modelo `emp_garbo.contratos_modelos` id `12adda4f-8d27-4482-8c64-a3c8e544df87`, "Contrto sem e-mail", ativo. É a base do texto do §9.

## 3. Os campos semeados

> O plano fala em "18 campos", mas a lista dele tem **17** (5 + 5 + 7). São estes 17; os testes conferem 17.

| # | Grupo | `nome` | `label` | `tipo` | `valor_padrao` | obrig. | link público | ordem |
|---|---|---|---|---|---|---|---|---|
| 1 | Cliente | `cpf` | CPF do Contratante | cpf | — | sim | não | −1 |
| 2 | Cliente | `nome_do_cliente` | Nome do cliente | texto | — | sim | sim | 1 |
| 3 | Cliente | `endereco` | Endereço do cliente | texto | — | sim | não | 2 |
| 4 | Cliente | `telefone` | Telefone do cliente | texto | — | sim | sim | 3 |
| 5 | Cliente | `email` | E-mail do cliente | texto | — | não | sim | 4 |
| 6 | Obra | `valor_total` | Valor total | valor | — | sim | não | 10 |
| 7 | Obra | `ambientes_contemplados` | Ambientes contemplados | texto | — | sim | não | 11 |
| 8 | Obra | `prazo_entrega_dias` | Prazo de entrega (dias corridos) | numero | — | sim | não | 12 |
| 9 | Obra | `data_inicio_obra` | Início da contagem do prazo | data | — | sim | não | 13 |
| 10 | Obra | `data_assinatura` | Data da assinatura | data | — | sim | não | 14 |
| 11 | Ajustáveis | `percentual_entrada` | Entrada (%) | numero | `60` | sim | não | 20 |
| 12 | Ajustáveis | `garantia_anos` | Garantia (anos) | numero | `2` | sim | não | 21 |
| 13 | Ajustáveis | `tolerancia_dias` | Tolerância (dias) | numero | `10` | sim | não | 22 |
| 14 | Ajustáveis | `prazo_ajustes_dias` | Prazo para pedir ajustes (dias) | numero | `30` | sim | não | 23 |
| 15 | Ajustáveis | `foro_cidade` | Foro (cidade/UF) | texto | `{{empresa_cidade_uf}}` | sim | não | 24 |
| 16 | Ajustáveis | `chave_pix` | Chave PIX | texto | `{{empresa_cnpj}}` | sim | não | 25 |
| 17 | Ajustáveis | `incluir_clausula_imagem` | Incluir cláusula de uso de imagem | sim_nao | `sim` | não | não | 26 |

`email` não aparece no texto do modelo padrão (a base é o "sem e-mail"). Fica cadastrado para quem quiser usar `{{email}}`, e o formulário só o mostra se o modelo o citar.

## 4. Sintaxe e motor (`src/lib/contrato-variaveis.ts`)

Ordem de processamento em `montarConteudoContrato` (chamado por `buildConteudoContrato`):

1. **Valores padrão.** `resolverValoresPadrao(variaveis, valoresEmpresa)`: para cada campo com `valor_padrao`, troca os `{{empresa_*}}` dentro dele. Campo vazio recebe o padrão resolvido.
2. **Normalização.** `valor` vira `10.000,00` (sem "R$"; o modelo escreve `R$ {{valor_total}}`); `data` vira "18 de novembro de 2026" (comportamento atual).
3. **Calculadas** (nunca pedidas; o valor digitado pelo usuário tem prioridade):
   - `{{X_extenso}}` para todo campo X do tipo `valor` (`valorMonetarioPorExtenso`) ou `numero` (`numeroPorExtenso`, novo, exportado de `valor-monetario-extenso.ts`);
   - com `valor_total` e `percentual_entrada`: `valor_entrada` = total × % arredondado em centavos; `valor_saldo` = total − entrada, em centavos (sem erro de arredondamento); `percentual_saldo` = 100 − %; e os `_extenso` de cada um.
4. **Blocos condicionais** `{{#se nome}}…{{/se}}`:
   - verdadeiro = `sim`, `s`, `true`, `1`, `yes` (sem acento/caixa); falso = `nao`/`não`, `n`, `false`, `0`, `no`;
   - valor ausente ou vazio (sem padrão) **mantém** o trecho (a prévia do modelo mostra a cláusula);
   - ao manter, some só a linha do marcador; ao remover, some o trecho e a quebra de linha depois do `{{/se}}`, sem sobrar linha vazia;
   - sem aninhamento (o primeiro `{{/se}}` fecha o bloco).
5. **Troca dos `{{x}}`** com `substituirVariaveis` (empresa, depois calculadas, depois usuário). Variável sem valor continua como `{{x}}` (comportamento atual).

`extrairVariaveisModelo(template)` devolve os `{{x}}` **e** os nomes dos blocos `#se`: é a base do "só os campos do modelo" (RF07).

**Nomes reservados** (não viram campo manual): `empresa_*` (todas de `VARIAVEIS_EMPRESA`), `valor_entrada`, `valor_saldo`, `percentual_saldo` e qualquer `X_extenso` em que X é campo valor/número. Campos antigos já cadastrados com esses nomes continuam funcionando (o valor do usuário vence).

## 5. Variáveis `empresa_*` novas

| Variável | Fonte | Exemplo |
|---|---|---|
| `{{empresa_cidade_uf}}` | `empresas.cidade` + `uf` | `Lavras/MG` |
| `{{empresa_representante_nome}}` | `empresas.representante_nome` (novo) | `Maria Souza` |
| `{{empresa_representante_cpf}}` | `empresas.representante_cpf` (novo, só dígitos), exibido com máscara | `123.456.789-09` |
| `{{empresa_representante_qualificacao}}` | `empresas.representante_qualificacao` (novo) | `brasileira, casada, marceneira` |

As 6 atuais (`empresa_nome`, `empresa_razao_social`, `empresa_cnpj`, `empresa_endereco`, `empresa_telefone`, `empresa_email`) continuam iguais.

## 6. Banco — migration `20261118130000_contrato_padrao.sql`

1. `"CRM-multi-empresas>empresas<"`: `representante_nome`, `representante_cpf`, `representante_qualificacao` (`text` nullable).
2. `app_minha_empresa()`: `drop` + `create` com as 3 colunas no fim; mesmos atributos (`language sql stable security definer set search_path = public, pg_temp`), `revoke … from public, anon` + `grant execute … to authenticated`.
3. `empresa_atualizar_dados(jsonb)`: `create or replace` com as 3 chaves na whitelist; CPF só com dígitos, 11 dígitos e dígitos verificadores válidos (senão erro `22023`). O resto fica igual (admin, master com acesso total, `app_assert_escrita_permitida()`).
4. `crm.contratos_variaveis`: `valor_padrao text`; `contratos_variaveis_tipo_check` recriada com `numero` e `sim_nao`; remove duplicatas de `cpf` (mantém a mais antiga); `unique (empresa_id, nome)`.
5. `crm_seed_contrato_padrao(p_empresa uuid)`: definer, `app_set_empresa_ctx`, `revoke` de public/anon/authenticated. Só age se a empresa não tiver **nenhum** modelo: insere os 17 campos (`on conflict (empresa_id, nome) do nothing`) e o modelo "Contrato padrão — móveis planejados" com `ativo = true`.
6. `plataforma_seed_empresa`: corpo de `20261118110000` + `perform crm_seed_contrato_padrao(p_empresa_id)`.
7. Backfill em laço sobre todas as empresas; zera `app.empresa_ctx` no fim.

## 7. Front

- **C03:** `EmpresaAtiva`/`mapEmpresa` (+3 campos), `EmpresaIdentidadeFonte`/`EmpresaIdentidade` (`representanteNome`, `representanteCpfFormatado`, `representanteQualificacao`, `cidadeUf`), `EmpresaDadosInput` (+3), bloco "Representante legal (aparece nos contratos)" em `EmpresaDadosForm`, `VARIAVEIS_EMPRESA` +4.
- **C04:** `contrato-variaveis.ts` (motor), `contrato-padrao.ts` (par TS do modelo e dos campos), `numeroPorExtenso` (nos dois lados do par), `scripts/test-contrato-padrao.mjs`.
- **C05:** `ContratosConfigPage` (valor padrão, tipos, calculadas, dica do `#se`, "Restaurar modelo padrão") e `NovoContratoPage` (padrões, Switch, só campos do modelo, calculadas em leitura).

## 8. Riscos

| Risco | Mitigação |
|---|---|
| A Garbo não tem modelo no banco novo, então o backfill semeia o padrão nela. Se ela depois migrar o "Contrto sem e-mail", ficará com 2 modelos (o padrão ativo). | Esperado pelo plano; a empresa escolhe o ativo na tela. Registrado no relatório. |
| `unique (empresa_id, nome)` quebraria com duplicatas. | Consulta da C01: zero duplicatas. A migration remove duplicatas de `cpf` antes, por segurança. |
| O auto-insert do `{{cpf}}` em `useContratosVariaveis` pode bater no `unique` numa corrida. | O hook já ignora erro do insert; com o seed o `cpf` já existe. |
| `drop function app_minha_empresa()` derruba grants e dependências. | Sem dependentes SQL conhecidos (o front chama por RPC); a migration regrava os grants e roda em transação. |
| Representante vazio deixa "representada por , , inscrito no CPF sob o nº ,". | A tela de Configurações mostra aviso quando faltar dado da empresa usado pelo modelo. |
| "garantia de 1 (um) anos": plural fixo do texto original. | Aceito (o padrão é 2); anotado. |
| Campo `valor` fora do padrão BR. | `parseValorMonetarioBr`; se não interpretar, o texto mantém o que foi digitado e o `_extenso` fica sem valor. |
| `compose-contrato-ia` reescrever `{{#se}}`. | Conferir o prompt na C06; deploy só com autorização. |
| Divergência TS ↔ SQL do texto padrão. | `test-contrato-padrao.mjs` compara o texto do `.ts` com o da migration. |

## 9. Texto do modelo padrão (generalizado)

Base: modelo ativo da Garbo no banco antigo, com as cláusulas na íntegra.

- Contratada, entrada/saldo, PIX, garantia, prazo, tolerância, ajustes, foro e fecho passam a usar variáveis.
- A cláusula de imagem virou o item **4.4**, dentro de `{{#se incluir_clausula_imagem}}` (o título "5. DO USO DE IMAGEM E DIREITOS AUTORAIS" saiu).
- As cláusulas 6 e 7 viraram 5 e 6.
- Correções: "in razão" → "em razão"; "sob o  {{cpf}}" → "sob o nº {{cpf}}"; espaço duplo em "após a entrega,  desde".

Nome do modelo: **Contrato padrão — móveis planejados**.

```text
CONTRATO DE PRESTAÇÃO DE SERVIÇO DE CONSTRUÇÃO, INSTALAÇÃO E MONTAGEM DE MÓVEIS PLANEJADOS

Por este instrumento particular de prestação de serviço, de um lado:
CONTRATANTE: {{nome_do_cliente}}, brasileiro(a), inscrito no CPF sob o nº {{cpf}}, residente e domiciliado {{endereco}}, Telefone: {{telefone}}.

CONTRATADO: {{empresa_razao_social}}, inscrita no CNPJ sob o nº {{empresa_cnpj}}, Telefone: {{empresa_telefone}}, neste ato representada por {{empresa_representante_nome}}, {{empresa_representante_qualificacao}}, inscrito no CPF sob o nº {{empresa_representante_cpf}}, com endereço profissional na {{empresa_endereco}}.

Têm entre si, justo e contratado, a PRESTAÇÃO DE SERVIÇOS DE MARCENARIA, mediante os termos e condições abaixo discriminados.

1. DO OBJETO DA CONTRATAÇÃO
1.1 Por se tratar de produção de móveis personalizados e pré-aprovados pela CONTRATANTE, não serão permitidas trocas de nenhuma natureza nos materiais descritos na especificação técnica, exceto aquelas eventualmente necessárias e detectadas no momento da medição técnica, bem como aquelas que não prejudiquem o orçamento aprovado, sob pena de variação no preço do objeto contratado.
1.2 A CONTRATADA não será responsável pelos serviços de elétrica e hidráulica, bem como adaptações e/ou adequações de alvenaria, elétrica ou estrutura de rebocos e paredes no local onde serão instalados os móveis.
1.3 Para a instalação dos móveis com fita LED e outros componentes elétricos, deverá a CONTRATADA, após análise das partes e se necessário, prover a contratação de profissional eletricista para acompanhar a montagem, de forma que a instalação não fique prejudicada.
2. DO PREÇO E CONDIÇÕES DE PAGAMENTO
2.1 O preço total acordado para o conjunto dos móveis planejados, incluindo todo o material, ferragens especiais, visitas técnicas de medição, instalação e acabamento, é de R$ {{valor_total}} ({{valor_total_extenso}}), o qual será quitado pelo CONTRATANTE da seguinte forma:
a) Entrada ({{percentual_entrada}}%): O valor de R$ {{valor_entrada}} ({{valor_entrada_extenso}}), a ser pago obrigatoriamente por meio de transferência eletrônica instantânea via PIX (Chave PIX: {{chave_pix}} - {{empresa_nome}}) no ato de assinatura deste instrumento. Este contrato passará a ser plenamente efetivo e o início dos prazos de fabricação e entrega previstos na Cláusula 4.1 passará a contar somente após a efetiva compensação e recebimento do referido pagamento via PIX;
b) Entrega ({{percentual_saldo}}%): O valor restante de R$ {{valor_saldo}} ({{valor_saldo_extenso}}), a ser pago imediatamente após a efetiva entrega, montagem e finalização de todos os móveis objeto deste contrato.
2.2 Caso o projeto aprovado seja modificado, por pedido ou mediante autorização da CONTRATANTE, durante a visita técnica de medição e posterior execução, poderá o CONTRATADO reajustar o valor do ORÇAMENTO.
3. DAS OBRIGAÇÕES DAS PARTES
3.1 Sendo obrigações do CONTRATANTE:
a) Disponibilizar o local da montagem livre de obras de construção ou reforma. Se por qualquer motivo a instalação for sobrestada em razão de tais obras, o pagamento referente à montagem deverá ser creditado até a data estipulada da entrega total, para que esta seja remarcada de comum acordo, não sendo os CONTRATADOS responsabilizados por atrasos a que não deram causa;
b) Apresentar ao profissional responsável pela montagem e instalação dos bens a planta hidráulica, elétrica, de aquecimento, refrigeração ou de gás do local. A inobservância desta cláusula desobriga o CONTRATADO de qualquer responsabilidade por eventuais danos de instalação;
c) Apresentar-se ou designar responsável no local da montagem, nos dias e horários combinados com o CONTRATADO, para viabilizar a realização dos serviços;
d) O CONTRATADO exime-se de qualquer responsabilidade referente a: existência de rebocos e tijolos frágeis ou de má qualidade que impeçam a sustentação robusta dos móveis; desníveis de paredes que impossibilitem a instalação segura; e ocorrência de focos de umidade, exposição solar excessiva ou infestações de insetos que possam danificar os bens.
3.2 Sendo obrigações dos CONTRATADOS:
a) Empregar as melhores técnicas e utilizar os melhores materiais para a execução do projeto ora contratado;
b) Cumprir todos os prazos aqui estipulados e cientificar o CONTRATANTE sobre as etapas de cumprimento dos serviços;
c) Produzir, instalar e adaptar o móvel na estrutura do ambiente, de acordo com o projeto de interiores referenciado;
d) Garantir o funcionamento de toda a estrutura, fornecendo garantia de {{garantia_anos}} ({{garantia_anos_extenso}}) anos, desde que o ambiente esteja livre de vazamentos e outros vícios que possam comprometer a integridade da madeira e/ou dos revestimentos.
4. DOS PRAZOS E OUTRAS AVENÇAS
4.1 É obrigação do CONTRATADO entregar, instalar e montar os produtos no prazo de {{prazo_entrega_dias}} ({{prazo_entrega_dias_extenso}}) dias corridos a contar do dia {{data_inicio_obra}}, observado o condicionante de efetivação do contrato descrito na Cláusula 2.1 (a). Considera-se também um prazo de {{tolerancia_dias}} ({{tolerancia_dias_extenso}}) dias de tolerância em caso de imprevistos devidamente justificados, observando-se o seguinte:
a) O CONTRATADO informará acerca do desenvolvimento da produção e realizará as instalações em etapas, de modo que no prazo indicado, todos os móveis estejam devidamente instalados;
b) Caso ocorram avarias nos móveis já instalados em razão da movimentação de outros prestadores de serviço no decorrer da finalização da obra, não haverá cobertura pela garantia do CONTRATADO;
c) Eventuais ajustes, regulagens e acabamentos adicionais podem ser realizados após a entrega, desde que solicitados pelo CONTRATANTE, não sendo computados no prazo limite do item 4.1.
4.2 Instalados e montados os produtos, a CONTRATANTE terá o prazo de {{prazo_ajustes_dias}} ({{prazo_ajustes_dias_extenso}}) dias para sinalizar a necessidade de ajustes técnicos adicionais.
4.3 A vigência do presente contrato inicia-se na data de sua assinatura e encerra-se com a efetiva entrega dos serviços.
{{#se incluir_clausula_imagem}}
4.4 A CONTRATANTE autoriza a captação de imagens do processo de construção e finalização dos móveis planejados contratados para veiculação nas redes sociais do CONTRATADO, comprometendo-se este a preservar dados pessoais, endereço e valores, limitando-se à exibição do ambiente trabalhado (registro de "antes" e "depois").
{{/se}}

5. DESCRITIVO E ESPECIFICAÇÕES TÉCNICAS DO PROJETO
5.1 Ambientes Contemplados
{{ambientes_contemplados}}

5.2 Especificações de Materiais e Acabamentos
Corrediça telescópica oferece suavidade, enquanto a invisível proporciona estética e qualidade. Dobradiças com amortecimento garantem durabilidade e conforto. Já a dobradiça 3D se destaca pela regulagem precisa, acabamento sofisticado e melhor alinhamento das portas, proporcionando mais estabilidade, praticidade e um padrão superior.

6. DO FORO
As partes elegem o Foro da Comarca de {{foro_cidade}} para dirimir quaisquer dúvidas ou controvérsias oriundas deste instrumento, renunciando expressamente a qualquer outro, por mais privilegiado que seja.
E, por estarem justas e contratadas, assinam o presente instrumento em duas vias de igual teor e forma na presença das testemunhas abaixo designadas.

{{empresa_cidade_uf}}, {{data_assinatura}}.
```
