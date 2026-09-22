# PRD — Documento de Requisitos do Produto
## Sistema de Orçamentação com Inteligência Artificial para Marcenarias (Especializado na Família OpenAI GPT e Integrado à Engenharia da Planilha 4.0 Premium) — Versão v8

---

### 1. Visão Geral e Objetivos do Produto
O **Sistema de Orçamentação com IA** é um módulo de inteligência artificial projetado para automatizar o levantamento quantitativo de materiais, análise construtiva de projetos moveleiros, auditoria visual, especificação exaustiva de insumos e formação do preço de venda final. 

O objetivo principal é reduzir o tempo de elaboração de orçamentos (de horas/dias para minutos) mantendo alta assertividade, permitindo que a marcenaria atenda mais clientes, aumente a conversão de vendas e elimine prejuízos causados por erros de interpretação técnica ou esquecimento de insumos.

#### Mapeamento Exclusivo para a Família de Modelos OpenAI GPT:
Nesta versão da arquitetura, o sistema é projetado e otimizado para utilizar **exclusivamente os modelos de ponta da OpenAI**, aproveitando o ecossistema unificado de visão multimodal, raciocínio lógico e vetorização:
* **GPT-4o (`gpt-4o`)**: Modelo principal de visão computacional multimodal e extração técnica. Utilizado para a leitura detalhada de pranchas de PDF, plantas baixas, vistas frontais, croquis desenhados à mão e geração de objetos JSON complexos com coordenadas de marcação delimitadora (*bounding boxes*).
* **GPT-4o-mini (`gpt-4o-mini`)**: Modelo de ultra-alta velocidade e baixo custo. Utilizado para tarefas de pré-processamento, ordenação de layout, classificação de pranchas simples e vínculo secundário de materiais (de/para de estoque).
* **o3-mini (`o3-mini`)**: Modelo de raciocínio profundo (*Reasoning Model*). Utilizado no nó **Supervisor Agent** para planejamento estratégico e no nó **Auditor/Revisor Interno** para validação rigorosa de engenharia moveleira e física de montagem (furações, contagem de dobradiças e folgas de gaveta).
* **Text-Embedding-3-Small (`text-embedding-3-small`)**: Modelo de embeddings vetoriais (1536 dimensões). Utilizado para transformar o feedback de correções dos usuários em vetores numéricos persistidos no `pgvector` do Supabase para o ciclo de aprendizado contínuo (RAG).

#### Princípios Norteadores da Engenharia da Planilha 4.0 Premium:
* **Detalhamento e Discriminação Integral do Orçamento (Planilha 4.0)**: A IA deve **especificar absolutamente tudo o que foi cotado**, espelhando a granularidade da Planilha de Marcenaria 4.0 Premium. O resultado discrimina minuciosamente todas as peças de caixaria (bases, laterais, divisórias, prateleiras, fundos, sarrafos), frentes, portas, tamponamentos, fitas de borda por metro linear, ferragens por unidade, conectores, puxadores perfil (calculados em barras de 3m) com tampinhas laterais, acabamentos especiais (laca, lâmina natural, vidros/espelhos), serviços avulsos, mão de obra de fabricação/montagem e despesas logísticas.
* **Regra Estrita de Unidade para Acessórios e Consumíveis**: Tudo o que for ferragem, conector, parafuso, suporte de prateleira ou acessório é cadastrado e calculated **estritamente por unidade individual** (e nunca por caixa/pacote), prevenindo distorções onde a IA lançaria caixas inteiras para montar um único módulo.
* **Inteligência de Preços de Mercado e Fallback Interativo**: Quando um insumo extraído do projeto técnico em PDF não for localizado no cadastro de estoque/ERP da empresa (`inventory_items`), a IA busca um **preço de referência de mercado** (`market_reference_prices`). O sistema solicita confirmação do usuário na UI para autorizar o preço de mercado, digitar o valor manual ou cadastrar no estoque.
* **Aprendizado Contínuo por Correção (Self-Learning / Feedback Loop)**: Cada correção e explicação fornecida pelo usuário no modal de auditoria ("Explique a correção à IA") é vetorizada via `text-embedding-3-small`, armazenada na tabela `ai_memories` e reaplicada dinamicamente via RAG no subgrafo Extrator (`gpt-4o`) em todos os orçamentos futuros.
* **Auditoria Visual Integrada com Leitor Nítido de PDF**: A lista de insumos e módulos é diretamente vinculada e destacada visualmente nas plantas e vistas do PDF original via caixas delimitadoras (*bounding boxes*).

---

### 2. Arquitetura Front-End, Leitor de PDF e Configuração Visual (UI/UX)

A interface deve ser responsiva, fluida e projetada para alta produtividade em telas únicas ou configurações de múltiplos monitores.

#### 2.1. Instruções para Renderização do PDF e Edição Interativa (Audit Workspace)
Para garantir clareza visual máxima e permitir a auditoria de qualquer instrução calculada pela IA:
* **Engine de Renderização de Alta Definição**:
  * O leitor de PDF utiliza `react-pdf` / `pdfjs-dist` renderizado em canvas com resolução mínima de **200 DPI**, garantindo legibilidade perfeita de cotas, hachuras e notas de rodapé de arquitetura.
* **Camada Transparente de Bounding Boxes (SVG Overlay)**:
  * Sobreposto ao canvas do PDF, o sistema renderiza uma camada SVG transparente indexada por coordenadas relativas \((x, y, \text{largura}, \text{altura})\) na faixa de \(0.0\) a \(1.0\).
* **Highlight Sincronizado**:
  * Ao clicar em qualquer módulo, peça ou insumo da lista técnica à direita, o leitor navega automaticamente até a prancha/página correspondente, aplica zoom e destaca a caixa delimitadora com um retângulo neon (`#0066FF`).
* **Visualização Dual Monitor (Popout Window)**:
  * O leitor de PDF possui um botão para ser destacado em uma janela independente (`Popout Window`) para uso em um segundo monitor, mantendo sincronia de estados e cliques bidirecionais em tempo real.
* **Fluxo de Edição Inline e Aprendizado**:
  * Clique duplo sobre qualquer item permite alterar quantidades ou materiais. Ao salvar, abre-se o modal *"Explique a correção à IA"*.
  * O texto preenchido é enviado para a API em TypeScript, transformado em embedding via OpenAI `text-embedding-3-small` e persistido na tabela `ai_memories` do Supabase para guiar orçamentos futuros.

#### 2.2. Central de Informações e Configuração de Padrões da Empresa (`company_standards`)
A interface oferece um modal gráfico parametrizável baseado na **Central de Informações da Planilha 4.0 Premium**:
1. **Padrão Construtivo do Móvel**: Seleção entre Métodos Construtivos (Método A, Método B, Método C) definindo rebaixo de fundos, sarrafos de topo e recuos.
2. **Descontos de Portas e Puxadores Perfil/Régua**:
   * Configuração do desconto em milímetros para puxadores perfil (ex: 35mm, 30mm, 20mm) e puxadores de borda sutil.
   * Regra estrita de cálculo para puxadores de régua: considerar **estritamente barras de 3 metros** (desconsiderando barras de 6m para evitar distorção de estoque) e somar a quantidade exata de **tampinhas laterais/suportes de acabamento** por unidade.
3. **Dispositivos de Montagem e Fixação**:
   * Seleção do padrão de fixação de prateleiras: suporte 2 furos ou cadeirinha.
   * Fixação do móvel na parede: cantoneiras em L (2 ou 3 furos), cantoneiras metálicas reforçadas ou réguas de MDF cortadas em 45º.
   * Padrão de conectores: Minifix, VB35, Rafix, cavilhas ou parafusos 40x4.
4. **Gaveteiros e Componentes de Movimentação**:
   * Padrão de corrediças: telescópicas (450mm 45kg HF) vs. ocultas com amortecedor.
   * Uso de gavetas internas com afastadores laterais.
   * Regra de quantidade de dobradiças por porta conforme a altura.
   * Pista e pistões basculantes: força normal, força inversa ou mini pistões.
   * Kits de portas de correr: sistemas com trilhos duplos superiores/inferiores e roldanas (ex: sistema RO-65 para portas de até 60kg).
5. **Acabamentos Especiais**:
   * **Laca**: Especificação de Laca Branca/Colorida (Acetinada ou Alto Brilho) configurando quantidade de lados laqueados (1 lado, 2 lados, 4 lados).
   * **Lâmina Natural**: Revestimento em lâmina natural (ex: Freijó) por \(m^2\) e lados aplicados.
   * **Vidros e Espelhos**: Portas de alumínio com vidro (reflecta, canelado) ou painéis com espelho prata 4mm (perfis 1036 fosco, puxadores 3178T, esquadretas 50 com película de proteção).

#### 2.3. Matriz de Verificação Ponto a Ponto de Todos os PDFs da Planilha 4.0 no PRD
Todos os **32 PDFs técnicos** da Planilha 4.0 Premium fornecidos nas fontes foram verificados e incorporados às especificações deste PRD:

| # | Arquivo PDF da Planilha 4.0 | Conteúdo / Regra de Engenharia Extraída | Status no PRD v8 |
|---|-----------------------------|-----------------------------------------|------------------|
| 1 | `Central de Informações.pdf` | Métodos A, B e C, espessuras (15, 18, 25mm, fundo 6mm), descontos de portas/puxadores, Laca e Lâmina Natural. | ✅ Mapeado (Seção 2.2) |
| 2 | `Cad. de chapas e bordas.pdf` | Cadastro de MDFs, % de margem de perda para chapas e fitas, custo/m² e conversão em chapas inteiras. | ✅ Mapeado (Seções 3.2 & 5) |
| 3 | `Cad. de Acessórios.pdf` | Precificação por **UNIDADE INDIVIDUAL**: parafusos 4x40, cavilhas, Minifix, VB35, cantoneiras (2/3 furos e réguas 45º), corrediças, dobradiças, pistões, kits RO-65 e aramados. | ✅ Mapeado (Seção 5) |
| 4 | `Cad. Serviços Avulsos.pdf` | Diárias de marceneiro/montador e ajudante com alimentação/almoço, mais serviços terceirizados de corte/borda (Cortecloud). | ✅ Mapeado (Seção 5) |
| 5 | `Cad. Portas de vidros e espelho.pdf` | Espelhos 4mm, vidros reflecta (prata/bronze), perfis (1036, 3178T), puxadores (2018, 3034, 3260), esquadretas 50/70 e película. | ✅ Mapeado (Seção 2.2) |
| 6 | `LISTA DE COMPRAS COMPLETA.pdf` | Regra de Arredondamento: Quantidades exatas de projeto (m², m, un) vs. Compras inteiras (Chapas inteiras, Rolos de borda, Barras de puxador de 3m + tampinhas). | ✅ Mapeado (Seção 3.2) |
| 7 | `ORÇAMENTO GERAL.pdf` | As 3 modalidades de precificação: Modalidade 1 (MPC % com mão de obra, impostos e lucro); Modalidade 2 (Multiplicador Material x N); Modalidade 3 (Preço por m²). | ✅ Mapeado (Seção 5) |
| 8 | `AI - C divisória compartilhada.pdf` | Armário Inferior com divisória compartilhada, avental, máscara de forno e portas de giro. | ✅ Mapeado (Seção 2.2) |
| 9 | `AI - Canto Oblíquo 1 porta.pdf` | Armário Inferior de Canto Oblíquo com 1 porta e prateleira chanfrada. | ✅ Mapeado (Seção 2.2) |
| 10| `AI - Canto L 2 portas.pdf` | Armário Inferior de Canto em L com 2 portas e dobradiça de canto especial. | ✅ Mapeado (Seção 2.2) |
| 11| `AI - Gavetas horizontal.pdf` | Gaveteiros horizontais com frentes falsas, engrosso e afastadores. | ✅ Mapeado (Seção 2.2) |
| 12| `AS - C divisória compartilhada.pdf` | Armário Superior com divisória compartilhada, basculante e aramado porta-latas/pratos. | ✅ Mapeado (Seção 2.2) |
| 13| `AS - Canto Oblíquo 1 porta.pdf` | Armário Superior de Canto Oblíquo. | ✅ Mapeado (Seção 2.2) |
| 14| `AS - Canto em L 2 portas.pdf` | Armário Superior de Canto em L 2 portas. | ✅ Mapeado (Seção 2.2) |
| 15| `Armário - Portas de Correr.pdf` | Armários suspensos com portas de correr, trilhos superiores/inferiores e guias RO-65. | ✅ Mapeado (Seção 2.2) |
| 16| `Armário c Rodapé - Canto L 2 po.pdf` | Armários de piso com rodapé em MDF e canto em L. | ✅ Mapeado (Seção 2.2) |
| 17| `Armário c rodapé - Canto Oblíqu.pdf`| Armários de piso com rodapé e canto oblíquo. | ✅ Mapeado (Seção 2.2) |
| 18| `Armário c rodapé - Portas de Ab.pdf`| Armários de piso com rodapé e portas de abrir/giro. | ✅ Mapeado (Seção 2.2) |
| 19| `Armário c rodapé - c ou s porta.pdf`| Armários de piso com rodapé com ou sem portas. | ✅ Mapeado (Seção 2.2) |
| 20| `Painel Liso.pdf` | Painel liso com alinhadores e estrutura de fixação em régua 45º. | ✅ Mapeado (Seção 2.2) |
| 21| `Painel Quadriculado.pdf` | Painel quadriculado com frisos horizontais e verticais. | ✅ Mapeado (Seção 2.2) |
| 22| `Painel Ripado.pdf` | Painel ripado com cálculo automatizado de quantidade, largura, profundidade e espaçamento de ripas. | ✅ Mapeado (Seção 2.2) |
| 23| `Painel horizontal c frisos.pdf` | Painel horizontal com frisos e montantes de acabamento. | ✅ Mapeado (Seção 2.2) |
| 24| `Nicho.pdf` | Nichos simples para caixarias de apoio. | ✅ Mapeado (Seção 2.2) |
| 25| `Nicho Adega.pdf` | Nicho adega com garrafeiro aramado ou colmeia de madeira. | ✅ Mapeado (Seção 2.2) |
| 26| `Nicho Engrossado.pdf` | Nichos com vista engrossada em 30mm/45mm e montantes duplos. | ✅ Mapeado (Seção 2.2) |
| 27| `Nicho interno .pdf` | Nicho interno aplicado dentro de vãos de armários. | ✅ Mapeado (Seção 2.2) |
| 28| `Sapateira interna .pdf` | Sapateira interna deslizante com corrediça e gaveta rasa. | ✅ Mapeado (Seção 2.2) |
| 29| `Gaveta interna c afastador .pdf` | Gaveta interna oculta por portas de giro com uso de afastadores laterais. | ✅ Mapeado (Seção 2.2) |
| 30| `Mesa com Saia.pdf` | Mesa de escritório/estudo com saia frontal e passa-cabos. | ✅ Mapeado (Seção 2.2) |
| 31| `Tamponamento.pdf` | Tamponamento 4 lados com engrosso e revestimento externo. | ✅ Mapeado (Seção 2.2) |
| 32| `AMBIENTES.pdf` | Agrupamento e separação do orçamento por múltiplos ambientes em uma única análise. | ✅ Mapeado (Seção 2.3) |

---

### 3. Arquitetura de Back-End e Infraestrutura (TypeScript & Supabase)

#### 3.1. Pipeline Assíncrono de Ingestão e Processamento
Devido ao tempo de raciocínio profundo dos agentes de visão e auditoria (10 a 20 minutos no modo Max), o processamento é executado assincronamente.

1. **Upload & Conversão**: PDF enviado ao `Supabase Storage` e convertido em imagens PNG/JPEG de alta resolução.
2. **Orquestração de Fila de Jobs**: Gerenciador de filas em TypeScript (**PgBoss**, **Inngest** ou **Trigger.dev**). Estados: `PENDING` $\rightarrow$ `CONVERTING_PAGES` $\rightarrow$ `READING_LAYOUT` $\rightarrow$ `EXTRACTING_MODULES` $\rightarrow$ `FETCHING_MARKET_PRICES` $\rightarrow$ `AUDITING_REVISION` $\rightarrow$ `COMPLETED` / `FAILED`.
3. **Notificações em Tempo Real**: Websockets via `Supabase Realtime`.

#### 3.2. Modelagem de Dados no Supabase (Schema PostgreSQL & pgvector)

```sql
-- 1. Extensão de Busca Vetorial
create extension if not exists vector;

-- 2. Tabela de Empresas e Créditos
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  credit_balance integer default 1000,
  created_at timestamp with time zone default now()
);

-- 3. Configurações Construtivas Padrão da Empresa (Planilha 4.0 Central)
create table company_standards (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade unique,
  box_thickness text default '15mm',
  back_panel_thickness text default '6mm',
  assembly_method text default 'minifix_cavilha',
  bottom_fixing text default 'rebaixo',
  tamponamento_rule text default 'empresa_25mm',
  door_handle_discount_mm integer default 35,
  handle_bar_length_m numeric(3,1) default 3.0,
  scope_rules jsonb default '{"led": "incluir", "serralheria": "nao_faz", "pedras": "nao_faz"}'::jsonb
);

-- 4. Tabela de Preços Referenciais de Mercado (Fallback)
create table market_reference_prices (
  id uuid primary key default gen_random_uuid(),
  category text not null, -- 'chapa', 'fita_borda', 'ferragem', 'puxador', 'consumivel'
  item_pattern text not null, -- Ex: 'MDF Branco TX 15mm', 'Corrediça Oculta 450mm'
  unit text not null default 'un',
  estimated_market_price numeric(10,2) not null,
  updated_at timestamp with time zone default now()
);

-- 5. Banco de Memória Dinâmica e Aprendizado por Correção (OpenAI Embeddings)
create table ai_memories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade not null,
  category text not null,
  user_instruction text not null,
  embedding vector(1536) not null, -- OpenAI text-embedding-3-small
  created_at timestamp with time zone default now()
);

create index on ai_memories using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- 6. Função RPC para Busca de Memórias Semânticas (RAG)
create or replace function match_ai_memories (
  query_embedding vector(1536),
  filter_company_id uuid,
  match_threshold float default 0.7,
  match_count int default 10
)
returns table (
  id uuid,
  category text,
  user_instruction text,
  similarity float
)
language sql stable
as $$
  select
    ai_memories.id,
    ai_memories.category,
    ai_memories.user_instruction,
    1 - (ai_memories.embedding <=> query_embedding) as similarity
  from ai_memories
  where ai_memories.company_id = filter_company_id
    and 1 - (ai_memories.embedding <=> query_embedding) > match_threshold
  order by ai_memories.embedding <=> query_embedding
  limit match_count;
$$;

-- 7. Tabelas do Orçamento e Lista de Compras Completa
create table quote_analyses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  mode text default 'max',
  status text default 'PENDING',
  created_at timestamp with time zone default now()
);

create table quote_environments (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid references quote_analyses(id) on delete cascade,
  name text not null
);

create table quote_modules (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid references quote_environments(id) on delete cascade,
  name text not null,
  description text,
  dimensions jsonb,
  bounding_box jsonb
);

create table quote_materials (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references quote_modules(id) on delete cascade,
  raw_name text not null,
  category text not null,
  system_material_id uuid,
  using_market_price boolean default false,
  unit_price numeric(10,2) not null,
  exact_quantity numeric(10,3) not null,
  full_units_quantity integer not null,
  unit_measure text not null default 'un'
);
```

---

### 4. Engine de IA: Arquitetura Multi-Agente 100% OpenAI GPT (LangGraph JS + Vercel AI SDK)

```
                ┌─────────────────────────────────────────┐
                │          Supervisor Agent               │
                │     (LangGraph JS + o3-mini/GPT-4o)     │
                └────────────────────┬────────────────────┘
                                     │ Command({ goto, update })
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   Parser Node    │       │  Extractor Node  │       │   Auditor Node   │
│ (Subgrafo TS/JS) │       │ (Subgrafo TS/JS) │       │ (Subgrafo TS/JS) │
│   (gpt-4o-mini)  │       │     (gpt-4o)     │       │    (o3-mini)     │
└──────────────────┘       └──────────────────┘       └──────────────────┘
```

#### 4.1. Passo 1 — Extração Exaustiva e Regras da Planilha 4.0 no Nó Extrator (`gpt-4o`)
O System Prompt e o schema Zod do subgrafo Extrator exigem que o `gpt-4o` fatie o móvel e extraia **todos os itens individuais**:
* **Caixaria**: Peças em MDF com largura, comprimento, função e tipo de fita nas bordas (C1, C2, L1, L2).
* **Puxadores**: Puxadores de régua em barras de 3m + tampinhas de acabamento lateral por unidade.
* **Ferragens e Acessórios**: Unidades exatas de corrediças, dobradiças, pistões, minifix, VB35, cavilhas, parafusos, cantoneiras e suportes.
* **Consumíveis**: Cola granulada, cola branca, kit limpeza/obra (tiner, silicone, cartela tapa-furo).
* **Serviços Avulsos e Mão de Obra**: Fita colada por metro linear, furações de dobradiça, dias de marceneiro/montador e ajudante.

#### 4.2. Passo 2 — Sistema de Aprendizado Contínuo (Self-Learning / Feedback Loop)
1. **Captura da Correção na UI**: Quando o usuário altera um item e digita a justificativa no campo *"Explique a correção à IA"*, a função `saveCompanyMemory` é disparada.
2. **Vetorização**: O texto é convertido em vetor de 1536 dimensões via `text-embedding-3-small` e salvo na tabela `ai_memories`.
3. **Injeção RAG em Futuros Orçamentos**: A função RPC `match_ai_memories` recupera as regras aprendidas relevantes e as injeta no System Prompt do subgrafo Extrator (`gpt-4o`).
4. **Resultado**: A IA aprende as particularidades da marcenaria e orça novos projetos aplicando as correções passadas de forma 100% automática.

---

### 5. Motor de Precificação (MPC) e Formação das 3 Modalidades de Preço da Planilha 4.0

O sistema consolida os insumos com a estrutura financeira e permite gerar a proposta em 3 modalidades:

1. **Modalidade 1: Orçamento por Margem de Lucro (% sobre Custo / MPC)**:
   $$\text{Custo Direto} = \text{Materiais} + \text{Serviços Avulsos} + \text{Mão de Obra (Fab/Mont)} + \text{Custos Fixos/Logística}$$
   $$\text{Preço de Venda Final} = \frac{\text{Custo Direto}}{\displaystyle 1 - \left( \frac{\%\text{Impostos} + \%\text{Comissões} + \%\text{Taxas Cartão} + \%\text{Margem Lucro}}{100} \right)}$$

2. **Modalidade 2: Orçamento por Multiplicador de Material (Material x N)**:
   $$\text{Preço de Venda Final} = \text{Custo de Materiais} \times N \quad (\text{ex: Custo} \times 2,0 \text{ ou } 2,8)$$

3. **Modalidade 3: Orçamento por Metro Quadrado (\(R\$/m^2\))**:
   $$\text{Preço de Venda Final} = \text{Metragem Quadrada Total do Móvel} \times \text{Valor do } m^2 \text{ Configurado (ex: R\$ 2.500/m}^2)$$

---

### 6. Estratégia de Desenvolvimento e Arquivo `.cursorrules`

No arquivo `.cursorrules` na raiz do seu repositório Next.js no Cursor Editor, mantenha estas instruções unificadas:

```markdown
# Diretrizes do Projeto — Módulo de Orçamento com IA (v8 - Planilha 4.0 Stack)

## Requisitos de IA e Regras de Negócio
1. LEITOR DE PDF E RENDERIZAÇÃO: Utilizar react-pdf/pdfjs-dist a 200 DPI com camada SVG transparente de bounding boxes. Suportar highlight sincronizado, zoom automático e janela flutuante Dual Monitor (Popout Window).
2. DISCRIMINAÇÃO EXAUSTIVA (PLANILHA 4.0): A IA deve extrair e discriminar 100% dos componentes (caixaria, tamponamentos, portas, fitas por metro, ferragens por unidade, conectores, puxadores perfil em barras de 3m + tampinhas, consumíveis, serviços avulsos e mão de obra de fabricação/montagem).
3. REGRA DE UNIDADE: Ferragens, conectores e acessórios devem ser calculados ESTRITAMENTE por unidade individual.
4. FALLBACK DE PREÇO DE MERCADO: Para insumos sem preço no estoque da empresa, busque o valor estimado em `market_reference_prices` e acione o flag de confirmação do usuário na UI.
5. APRENDIZADO CONTÍNUO (RAG): Toda explicação enviada no modal de correção deve ser vetorizada via OpenAI `text-embedding-3-small` e salva em `ai_memories`. Recupere e injete estas memórias no System Prompt do subgrafo Extrator (`gpt-4o`) para orçamentos futuros.
6. TRÊS MODALIDADES DE PRECIFICAÇÃO: Implementar cálculo de Preço por Margem de Lucro (MPC), Multiplicador de Material (Material x N) e Preço por Metro Quadrado (R$/m²).
```

---
*Documento v8 consolidado, com especificações do leitor de PDF a 200 DPI, janela flutuante Dual Monitor e matriz de verificação dos 32 PDFs da Planilha 4.0 Premium.*
