# Modelos padrão do master — Requisitos

> Design: [`DESIGN.md`](./DESIGN.md) · Tarefas: [`TASKS.md`](./TASKS.md) · ADR: [`0005`](../decisions/0005-modelos-padrao-por-empresa-modelo.md)

## Por quê

O sistema é um SaaS multi-empresa: marcenarias hoje, e gráficas e outros prestadores de serviço no futuro. Toda empresa nova começa vazia: sem tabela de preços, sem slides de orçamento, só com o contrato padrão. O master quer entregar empresas que já nasçam configuradas, a partir de modelos que ele monta e mantém.

## O que

- **RF1. Empresa-modelo.** O master cria empresas especiais por segmento (ex.: "Modelo Marcenaria", "Modelo Gráfica").
  - Elas não são clientes: não têm mensalidade e ficam fora dos KPIs e da lista de marcenarias.
  - O master entra nelas pelo /master em acesso total e edita markup, slides, contratos, apresentação e Pontua nas mesmas telas que as empresas usam.
- **RF2. Ponto de partida = Garbo.** A primeira empresa-modelo nasce com os dados da Garbo:
  - tabela de markup (categorias, produtos e preços, parâmetros, despesas, serviços, regras construtivas);
  - slides de orçamento (template, blocos, perguntas, formas de pagamento);
  - modelos de contrato e campos variáveis;
  - apresentação para arquitetos e Pontua.
- **RF3. Catálogo de modelos.** Em `/master/modelos`, o master vê o que cada empresa-modelo tem, por tipo, e decide o que está **publicado**:
  - markup, slides, apresentação e Pontua são publicados como pacote inteiro;
  - contratos são publicados **um a um**, e é possível ter vários modelos.
  - Contratos que já existem ficam no modelo **sem descer** para ninguém até o master publicar e enviar.
- **RF4. Modelos por plano.** Em `/master/planos`, cada plano marca quais modelos publicados recebe. Uma empresa criada com aquele plano já nasce com uma cópia deles.
- **RF5. Envio manual.** O master envia um modelo publicado para empresas já existentes quando quiser, e vê o histórico de entregas.
- **RF6. Cópia independente.** A empresa recebe uma **cópia**. Ela edita à vontade e isso não altera o modelo nem as outras empresas. Editar o modelo também não altera as cópias já entregues.
- **RF7. Reenvio só acrescenta.** Reenviar um modelo para quem já tem a cópia nunca apaga nem sobrescreve o que a empresa editou:
  - contrato chega como modelo novo, com "(v2)" no nome;
  - markup e slides recebem só os itens que faltam.
- **RF8. Imagens.** Logo, fundo de slide e papel timbrado chegam **vazios**: a empresa usa a logo do próprio cadastro. As fotos de catálogo e galeria continuam apontando para as do modelo.
- **RF9. Apresentação e Pontua editáveis.** Hoje são código fixo com textos, fotos e telefone da Garbo. Passam a ser conteúdo por empresa:
  - editor com **prévia ao vivo**;
  - link público por empresa (`/apresentacao/:slug`);
  - o formulário de parceria registra o arquiteto na empresa certa.

## Não objetivos

- Sincronizar automaticamente as cópias quando o modelo muda.
- Copiar dados de cliente: leads, orçamentos, contratos assinados, pontos e saques.
- Copiar chaves de IA. Cada empresa cadastra as suas.

## Critérios de sucesso

1. Empresa criada com um plano que tem modelos já abre `/markup`, `/orcamento-slides` e `/contratos` com os itens do modelo.
2. A empresa altera um preço ou uma cláusula, e o modelo, a Garbo e as outras empresas continuam iguais. Isso é provado por teste SQL e por teste via API real.
3. Reenviar não duplica itens nem apaga edições.
4. Não-master não consegue ler nem chamar nada de `plataforma_modelos*` ou `master_*`.
5. A apresentação de uma empresa nova mostra os dados dela (nome, contatos), e o formulário de parceria cria o lead nela.
6. Toda tarefa tem validação registrada no `TASKS.md` (regra do usuário: "toda alteração feita deve ser testada").
