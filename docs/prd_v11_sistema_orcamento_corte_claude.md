# PRD v11 - Sistema de Orçamentação e Precificação IA Modular & Transparente (Corte Claude)

**Versão:** 11.0  
**Data:** Outubro de 2026  
**Status:** Aprovado / Em Desenvolvimento  
**Autor:** Equipe de Engenharia e Produto - Corte Claude  
**Modelo de Precificação:** Engenharia Modular por Componentes (Padrão HelloMob / Cortecloud)  

---

## 1. Visão Geral e Mudança de Paradigma

### 1.1. Abandono da Precificação por Metro Quadrado ($m^2$)
A precificação tradicional por $m^2$ considera unicamente a área frontal externa do móvel (largura $\times$ altura), gerando distorções graves:
- **Prejuízo Operacional:** Móveis internos complexos (com diversas gavetas, corrediças ocultas, divisórias e dezenas de metros de fita de borda) são cobrados pelo mesmo valor de uma caixa vazia.
- **Perda de Orçamentos:** Cobrança excessiva em móveis simples de grande porte, tornando o valor inviável comercialmente.

### 1.2. A Solução: Precificação Modular por Componentes (HelloMob / Cortecloud)
O **Corte Claude v11** adota a lógica de desmonte do HelloMob:
1. **Reconhecimento Modular:** A IA identifica a tipologia do móvel a partir do projeto/croqui (ex: Balcão de Gavetas, Aéreo Basculante, Roupeiro de Correr).
2. **Aplicação de Preferências Construtivas:** O sistema injeta as regras globais de marcenaria da empresa (dispositivos de fixação, recuos, folgas, tipo de fundo).
3. **Desmonte em Tempo Real (BOM - Bill of Materials):** O móvel é decomposto em peças individuais, gerando a contagem exata de **chapas de MDF, metros lineares de fita de borda, ferragens, parafusos e componentes por unidade**.

---

## 2. Motor de Pré-definição de Preferências Construtivas (System Preferences Engine)

Antes do processamento de qualquer projeto, o sistema carrega o conjunto de **Preferências Globais** configurado pela marcenaria:

### 2.1. Estrutura de Caixas (Box Assembly)
- **Bases e Tampos:**
  - *Base:* Opção entre **Entre Laterais** ou **Por Baixo das Laterais (Passante)**.
  - *Tampo:* Opção entre **Entre Laterais**, **Por Dentro** ou **Por Cima das Laterais**.
- **Travessas Estruturais:**
  - *Orientação:* Horizontal ou Vertical (Dianteiras e Traseiras).
  - *Engrosso Duplo:* Ativação de trava dupla colada para reforço estrutural.
  - *Travessa em L:* Adição de travessa perpendicular para sustentação de bancadas pesadas.
- **Dispositivos de Montagem:**
  - Configuração por categoria (Aéreos, Balcões, Roupeiros e Nichos): **Parafuso Tradicional**, **Minifix + Cavilha**, ou **Cavilha Pura**.
- **Construção de Fundos:**
  - *Tipos:* Rasgado (Canal), Rebaixado, Pregado/Parafusado, ou Fundo Reforçado.
  - *Espessuras:* 3 mm, 6 mm ou 15 mm.
  - *Distância do Rasgo:* Padrão de 10 mm a 15 mm do bordo traseiro.
- **Gavetas e Corrediças:**
  - *Tipos de Trilho:* Telescópica Simples, Telescópica Light, Oculta com Amortecedor, ou Oculta Fecho Toque.
  - *Folgas:* Desconto automático de contrafundo e contrafrente conforme especificação do fabricante (ex: 26 mm total para telescópicas).
- **Folgas de Frentes e Bordeamento:**
  - *Folga Padrão:* 2 mm entre frentes de gaveta e portas de abrir.
  - *Bordeamento:* Regra de fita de borda por topo (Apenas Frente, Topos Aparentes ou Todos os Topos).

---

## 3. Regras de Montagem e Engenharia Construtiva dos Módulos 1 ao 11

### Módulo 1: Leitura de Croqui e Montagem Básica da Caixa
- **Captura de Cotas Externas:** Recepção das medidas nominais (Largura $\times$ Altura $\times$ Profundidade).
- **Estruturação de Base e Tampo:** Aplicação automatizada da regra de base por baixo/entre e tampo por cima/entre.
- **Explosão Inicial de Peças:** Desmonte da caixa em 2 laterais, 1 base, 1 tampo/travessas e 1 fundo, enviando as peças ao plano de corte e cálculo de insumos.

### Módulo 2: Multiplicação, Duplicação e Puxadores Cava/Passante
- **Multiplicar Módulo (`Qtd > 1`):** Duplica os componentes no plano de corte mantendo identidade estrita de peças.
- **Duplicar Módulo:** Cria uma cópia da engenharia no editor, permitindo alterar atributos visuais (ex: cor das frentes) reaproveitando os parâmetros de montagem.
- **Puxadores Cava em Travessas:**
  - Recuo vertical de cava ajustável: **0 mm** (cava manual no topo), **20 mm** (recuo com aviso de colisão com cantoneiras) ou **40 mm** (padrão de pega).
- **Puxadores Passantes em Aéreos:**
  - Controle de avanço da porta para baixo (**10 mm a 30 mm**), restrito a módulos de 1 porta.
- **Tratamento de Colisões:** Identificação automatizada de colisão entre travessas e divisórias centrais, sinalizando usinagem/recorte manual.

### Módulo 3: Construção Avançada de Caixas e Vãos Variáveis
- **Reforços Estruturais:** Ativação de engrosso duplo em travessas dianteiras/traseiras e montagem de travessas em L para balcões de pia e bancadas.
- **Posicionamento de Travessas vs. Fundo Rasgado:**
  - *Travessa Traseira Atrás do Fundo:* Exige rasgo de passagem na travessa.
  - *Travessa Traseira à Frente do Fundo:* Não exige usinagem na travessa.
- **Caixas de Vãos Variáveis:** Divisão de balcões com múltiplas colunas de larguras assimétricas (ex: Coluna 1 com 300 mm e Coluna 2 com 700 mm).

### Módulo 4: Preferências Globais e Personalização de Produção
- **Políticas de Bordeamento:** Atribuição de fita de borda por tipo de peça (Caixa, Prateleira, Frente).
- **Mapeamento de Hardware por Módulo:** Definição de conectores específicos para cada família de móveis.
- **Recuos e Folgas Personalizadas:** Ajustes milimétricos em recuos de prateleiras internas (mínimo de 10 mm de recuo em relação à frente da caixa).

### Módulos 5 e 6: Organização de Ambientes e Etiquetagem Industrial
- **Atribuição Multi-Ambiente:** Mapeamento de cômodos (Cozinha, Sala, Quarto) dentro do mesmo pedido de serviço.
- **Impressão de Etiquetas Industriais:** Transmissão da tag do ambiente para a etiqueta física impressa no parque fabril (facilita triagem no cliente).

### Módulo 7: Armários de Correr (Engenharia de Deslize)
- **Tamponamento Envoltório:** Aplicação de caixa externa de 18 mm/25 mm que abraça o móvel e oculta ferragens.
- **Submódulos Embutidos (Recuo Zero):** Dimensionamento de gaveteiros e sapateiras internas com recuo zero na profundidade útil.
- **Sarrafos Unilaterais em Divisórias:** Remoção do sarrafo da divisória central para impedir travamento de gavetas no transpasse das portas.
- **Frente Total de Coluna Única:** Reconhecimento do vão frontal como área única contínua para aplicação do kit deslizante (2, 3 ou 4 portas de correr).

### Módulo 8: Armários de Giro (Estrutura por Colunas)
- **Divisão por Colunas Independentes:** Mapeamento em **Coluna 1**, **Coluna 2**, etc., liberando a aplicação de portas de abrir individuais por seção.
- **Alinhamento de Puxadores:** Puxadores perfil ou alça configuráveis na vertical ou horizontal.
- **Visualização Raio X:** Inspeção 3D transparente para verificação de dobradiças, calços e furações CNC nas laterais.

### Módulo 9: Mapeamento Dinâmico de Vãos e Submódulos
- **Maleiros Individuais:** Ativação/desativação e ajuste de altura do maleiro por coluna independente.
- **Ajuste de Vão Inferior:** Edição da altura do vão inferior para recepção de gaveteiros ou nichos específicos.
- **Submódulos Dinâmicos:** Inserção de colmeias repartidas, sapateiras deslizantes e gaveteiros externos/internos.

### Módulo 10: Interface 3D e Engenharia Visual de Vãos
- **Tags de Vãos:** Identificação do status de cada compartimento no modelo 3D.
- **Navegação Avançada:** Renderização sem linhas pretas (suavização de arestas) e controle de zoom/pan focado na posição do cursor do mouse.

### Módulo 11: Salas, Nichos e Estética de Alto Padrão
- **Fecho Toque em Módulos Horizontais:** Eliminação de puxadores visíveis com uso de corrediças ocultas por fecho toque.
- **Nichos 100% Cavilha:** Montagem de nichos abertos com fixação por cavilha para eliminar parafusos e minifix aparentes (exige CNC calibrada).
- **Proteção contra Rasgos de Usinagem:** Desativação automática de rasgos de fundo em peças com topos expostos.
- **Painéis e Prateleiras Engrossadas:**
  - Painéis com estrutura de sarrafos/mão amiga.
  - Inversão de cotas para manter o veio da madeira na horizontal.
  - Prateleiras de espessura dupla (30 mm ou 36 mm) com uso de **Fita de Borda Larga (35 mm ou 45 mm)** para cobrir a emenda do engrosso.

---

## 4. Motor de Desmonte Modular e Cálculo Exato de Insumos (BOM)

### 4.1. Chapas de MDF / MDP
- **Cálculo de Área Real ($m^2$):** Somatório da área de cada peça desmembrada.
- **Conversão em Chapas Comerciais:** Divisão pela área útil da chapa padrão ($2,75\text{ m} \times 1,85\text{ m} = 5,0875\text{ m}^2$).
- **Margem de Perda (Kerf/Retalhos):** Aplicação dinâmica de +15% de perda para otimização do plano de corte.

### 4.2. Fitas de Borda
- **Metragem Linear Total ($m$):** Somatório do perímetro dos topos configurados para bordeamento.
- **Seleção da Largura de Fita:**
  - **Fita 22 mm:** Para chapas simples de 15 mm e 18 mm.
  - **Fita Larga 35 mm / 45 mm:** Para tampos e painéis engrossados (duas chapas coladas), cobrindo a junção do engrosso em uma única fita contínua.

### 4.3. Ferragens e Insumos Unitários
- **Parafusos e Cavilhas:** Contagem matemática exata por ponto de união.
- **Minifix / VB35:** Quantidade exata de tambores e pinos calculada por junção de caixaria.
- **Corrediças:** Contagem de pares por gaveta/sapateira.
- **Dobradiças:** Calculadas dinamicamente pela altura da porta (2 dobradiças até 900mm; 3 dobradiças até 1600mm; 4+ para alturas superiores).
- **Puxadores Perfil:** Calculados em metros lineares e arredondados para barras industriais de 3,0 m + kits de ponteiras.

---

## 5. Suite de Observabilidade e Controle Total da IA (Cockpit do Gestor)

Para garantir total transparência e eliminar o efeito "caixa-preta", o sistema disponibiliza quatro ferramentas de auditoria em tempo real:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        SUITE DE OBSERVABILIDADE E CONTROLE DA IA                       │
├──────────────────────────┬──────────────────────────┬──────────────────────────────────┤
│ 1. Chain of Thought (CoT)│ 2. Editor de Prompts     │ 3. Auditor de Preço (Price Audit)│
│ "Ver a IA Pensando"      │ (Prompt Studio / Override│ (Detalhamento Item a Item)       │
├──────────────────────────┴──────────────────────────┴──────────────────────────────────┤
│ 4. Inspector de Respostas em Tempo Real (Visualizador de JSON / Respostas dos Prompts)  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Raciocínio em Tempo Real ("Ver a IA Pensando" / Chain of Thought):**
   - Janela retrátil que exibe os passos lógicos da IA enquanto ela analisa o projeto, lê cotas, aplica a tabela de preferências e calcula a engenharia.
2. **Auditor de Preços (Price Auditor):**
   - Painel analítico estilo planilha detalhando o custo de cada parafuso, metro de fita, chapa de MDF, custo de corte/usinagem da central e markup comercial aplicado.
3. **Editor Dinâmico de Prompts (Prompt Studio):**
   - Interface de gestão onde o usuário pode alterar os System Prompts dos agentes de IA (Extrator, Desmontador e Auditor) e testar os impactos imediatamente.
4. **Visualizador de Respostas de Prompts (Response Inspector):**
   - Log em tempo real que exibe o JSON/Texto bruto retornado pela LLM em cada chamada, permitindo depuração e validação técnica imediata.

---

## 6. Arquitetura de Banco de Dados (Supabase / PostgreSQL)

### 6.1. Tabela: `system_preferences`
```sql
CREATE TABLE system_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    base_assembly VARCHAR(50) DEFAULT 'under_sides', -- 'under_sides' ou 'between_sides'
    top_assembly VARCHAR(50) DEFAULT 'over_sides',  -- 'over_sides', 'between_sides', 'inside'
    mounting_device VARCHAR(50) DEFAULT 'minifix_dowel', -- 'screw', 'minifix_dowel', 'dowel_only'
    back_panel_type VARCHAR(50) DEFAULT 'grooved', -- 'grooved', 'rebated', 'screwed'
    back_panel_thickness INT DEFAULT 6, -- 3, 6, 15
    drawer_slide_type VARCHAR(50) DEFAULT 'telescopic', -- 'telescopic', 'hidden_soft_close', 'touch'
    front_gap_mm NUMERIC(3,1) DEFAULT 2.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 6.2. Tabela: `bom_items` (Bill of Materials)
```sql
CREATE TABLE bom_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    module_id UUID NOT NULL,
    item_category VARCHAR(50) NOT NULL, -- 'board', 'edgeband', 'hardware', 'fastener'
    item_description VARCHAR(255) NOT NULL,
    quantity NUMERIC(10,3) NOT NULL,
    unit_of_measure VARCHAR(20) NOT NULL, -- 'm2', 'm', 'unit', 'pair', 'bar'
    unit_cost NUMERIC(10,2) NOT NULL,
    total_cost NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 7. Conclusão e Próximos Passos
O **PRD v11** consolida a transição do Corte Claude para uma plataforma de precificação de nível fabril industrial, unindo **precisão técnica de marcenaria** com **controle e auditoria total via Inteligência Artificial**.
