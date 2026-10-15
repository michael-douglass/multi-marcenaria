> **Atenção (2026-10-15):** este arquivo é um rascunho antigo (Python/Excel/Gemini).  
> A fonte operacional do sistema **real** (Vite + Supabase + BOM fabril / Corte Claude) está em:  
> **`docs/sistema_precificacao_ia_operacao_e_reparo.md`**  
> PRD canônico: `docs/prd_v11_sistema_orcamento_corte_claude.md`.

Vou gerar agora um documento completo, minucioso e passo a passo diretamente no seu editor de documentos ao lado.
Este manual mestre engloba toda a arquitetura, schemas de banco de dados, prompts de IA prontos para uso, fórmulas matemáticas de marcenaria, scripts de integração em Python e um estudo de caso prático do início ao fim.

Guia Mestre Executivo - IA Orçamentista de Marcenaria
1 de set., 00:51
┌────────────────────────────────────────────────────────────────────────┐
│ ENTRADA (PDF, Imagem, Texto) │
└───────────────────────────────────┬────────────────────────────────────┘
│
▼
┌────────────────────────────────────────────────────────────────────────┐
│ FASE 1: IA Multimodal de Leitura & Extração (Gemini / GPT-4o) │
│ • Extração de Cotas (L x A x P em mm) │
│ • Mapeamento de Tipologias, Componentes e Ferragens │
│ • Saída: JSON Técnico Bruto (Schema Estrito) │
└───────────────────────────────────┬────────────────────────────────────┘
│
▼
┌────────────────────────────────────────────────────────────────────────┐
│ FASE 2: Motor de Roteamento & Engenharia Construtiva │
│ • Mapeamento para Abas da Planilha (AI, AS, Nicho, Painel, etc.) │
│ • Aplicação de Regras Construtivas (Descontos, Rebaixos, Folgas) │
│ • Saída: JSON Mapeado com Parâmetros de Entrada da Planilha │
└───────────────────────────────────┬────────────────────────────────────┘
│
▼
┌────────────────────────────────────────────────────────────────────────┐
│ FASE 3: Motor de Precificação & Cálculo Financeiro (Python / Excel) │
│ • Cálculo de MDF (Chapas Inteiras com Perda de 20%) │
│ • Cálculo de Fita de Borda (Rolos de 20m/50m com Perda de 15%) │
│ • Cruzamento com Tabelas de Insumos (Cadastros de Preços) │
│ • Aplicação de Markup Commercial (Padrão: 2.80) │
└───────────────────────────────────┬────────────────────────────────────┘
│
▼
┌────────────────────────────────────────────────────────────────────────┐
│ SAÍDA: Proposta Comercial (Cliente) + Lista de Compras (Fábrica) │
└────────────────────────────────────────────────────────────────────────┘



---

## 2. Modelagem de Banco de Dados

Para viabilizar a automação e integração via API com a planilha Excel ou um banco relacional, o sistema utiliza três tabelas principais.

### 2.1 Tabela de Cadastro de Insumos (`cad_insumos`)
Mapeia os insumos das abas `Cad. de chapas e bordas`, `Cad. de Acessórios` e `Cad. Portas de vidros e espelho`.

```sql
CREATE TABLE cad_insumos (
    id_insumo INT PRIMARY KEY AUTO_INCREMENT,
    categoria ENUM('MDF', 'FITA_BORDA', 'FERRAGEM', 'PUXADOR', 'ACESSORIO', 'SERVICO') NOT NULL,
    codigo_sku VARCHAR(50) UNIQUE,
    descricao VARCHAR(255) NOT NULL,
    padrao_cor VARCHAR(100),
    espessura_mm DECIMAL(5,2),
    largura_mm DECIMAL(5,2),
    comprimento_mm DECIMAL(6,2),
    unidade_medida ENUM('UN', 'M2', 'M', 'ROLO', 'CHAPA', 'PAR', 'KG') NOT NULL,
    custo_unitario DECIMAL(10,2) NOT NULL,
    markup_padrao DECIMAL(4,2) DEFAULT 2.80,
    fornecedor_preferencial VARCHAR(100)
);


Registros de Exemplo (cad_insumos):
id_insumo
categoria
codigo_sku
descricao
padrao_cor
espessura_mm
unidade_medida
custo_unitario
101
MDF
MDF-BR-15
MDF Branco Supremo 2750x1840mm
Branco Supremo
$15,00$
CHAPA
R$ 240,00
102
MDF
MDF-LF-18
MDF Louro Freijó 2750x1840mm
Louro Freijó
$18,00$
CHAPA
R$ 380,00
201
FITA_BORDA
FIT-LF-22
Fita PVC Louro Freijó 22x1mm (20m)
Louro Freijó
$1,00$
ROLO
R$ 45,00
301
FERRAGEM
DOB-RET-AM
Dobradiça Reta Clip-On Amortecedor
N/A
N/A
UN
R$ 12,00
302
FERRAGEM
COR-OCU-500
Corrediça Oculta Slowmotion 500mm
N/A
N/A
PAR
R$ 85,00

2.2 Tabela de Mapeamento de Modulação (cad_modulos_planilha)
Mapeia os nomes exatos das abas da planilha com as células de entrada de dados.



SQL
CREATE TABLE cad_modulos_planilha (
    id_modulo INT PRIMARY KEY AUTO_INCREMENT,
    nome_aba VARCHAR(100) NOT NULL UNIQUE,
    categoria_movel VARCHAR(100) NOT NULL,
    celula_largura VARCHAR(10),
    celula_altura VARCHAR(10),
    celula_profundidade VARCHAR(10),
    celula_qtd_portas VARCHAR(10),
    celula_qtd_gavetas VARCHAR(10)
);


3. Fase 1: Ingestão e Extração Multimodal de Dados
3.1 JSON Schema Oficial para Validação do Output
A IA deve retornar um arquivo JSON validado estritamente por este schema:



JSON
{
  "$schema": "[http://json-schema.org/draft-07/schema#](http://json-schema.org/draft-07/schema#)",
  "title": "EspecificacaoProjetoMarcenaria",
  "type": "object",
  "properties": {
    "identificacao": {
      "type": "object",
      "properties": {
        "cliente": { "type": "string" },
        "ambiente": { "type": "string" },
        "data_projeto": { "type": "string" }
      },
      "required": ["cliente", "ambiente"]
    },
    "modulos": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id_modulo": { "type": "integer" },
          "nome_identificador": { "type": "string" },
          "tipo_movel": { "type": "string" },
          "dimensoes_finais_mm": {
            "type": "object",
            "properties": {
              "largura": { "type": "number" },
              "altura": { "type": "number" },
              "profundidade": { "type": "number" }
            },
            "required": ["largura", "altura", "profundidade"]
          },
          "espessuras_chapas_mm": {
            "type": "object",
            "properties": {
              "corpo": { "type": "number", "default": 15 },
              "portas_frentes": { "type": "number", "default": 18 },
              "fundo": { "type": "number", "default": 6 }
            }
          },
          "componentes": {
            "type": "object",
            "properties": {
              "qtd_portas_abrir": { "type": "integer", "default": 0 },
              "qtd_portas_correr": { "type": "integer", "default": 0 },
              "qtd_gavetas": { "type": "integer", "default": 0 },
              "qtd_prateleiras": { "type": "integer", "default": 0 }
            }
          },
          "ferragens_especificadas": {
            "type": "object",
            "properties": {
              "tipo_dobradica": { "type": "string" },
              "tipo_corredica": { "type": "string" },
              "modelo_puxador": { "type": "string" }
            }
          },
          "acabamentos_materiais": {
            "type": "object",
            "properties": {
              "mdf_corpo": { "type": "string" },
              "mdf_frentes": { "type": "string" },
              "fita_borda_corpo": { "type": "string" },
              "fita_borda_frentes": { "type": "string" }
            }
          }
        },
        "required": ["id_modulo", "nome_identificador", "dimensoes_finais_mm"]
      }
    }
  }
}


3.2 Exemplo de Entrada e Saída (Fase 1)
Texto de Entrada (Solicitação do Cliente):
"Preciso orçar um balcão inferior de cozinha para pia, com 1200mm de largura, 850mm de altura total e 600mm de profundidade. A caixaria deve ser em MDF Branco Supremo 15mm e as frentes em MDF Louro Freijó 18mm. Deve ter 2 portas de abrir e 3 gavetas. Usar corrediças ocultas de 500mm slowmotion e dobradiças reta clip-on. Puxadores perfil alumínio."
JSON Gerado pela IA (Fase 1):



JSON
{
  "identificacao": {
    "cliente": "Ricardo Oliveira",
    "ambiente": "Cozinha Gourmet",
    "data_projeto": "2026-09-01"
  },
  "modulos": [
    {
      "id_modulo": 1,
      "nome_identificador": "Balcão Inferior de Pia",
      "tipo_movel": "Armário Inferior",
      "dimensoes_finais_mm": {
        "largura": 1200,
        "altura": 850,
        "profundidade": 600
      },
      "espessuras_chapas_mm": {
        "corpo": 15,
        "portas_frentes": 18,
        "fundo": 6
      },
      "componentes": {
        "qtd_portas_abrir": 2,
        "qtd_portas_correr": 0,
        "qtd_gavetas": 3,
        "qtd_prateleiras": 1
      },
      "ferragens_especificadas": {
        "tipo_dobradica": "Dobradiça Reta Clip-On Amortecedor",
        "tipo_corredica": "Corrediça Oculta Slowmotion 500mm",
        "modelo_puxador": "Perfil Alumínio Borda Sutil Anodizado"
      },
      "acabamentos_materiais": {
        "mdf_corpo": "MDF Branco Supremo",
        "mdf_frentes": "MDF Louro Freijó",
        "fita_borda_corpo": "Fita PVC Branca 22x0.45mm",
        "fita_borda_frentes": "Fita PVC Louro Freijó 22x1.0mm"
      }
    }
  ]
}


4. Fase 2: Regras Construtivas e Mapeamento para a Planilha
4.1 Fórmulas Matemáticas de Engenharia Construtiva
Para desdobrar o móvel em peças de corte e ferragens, o sistema aplica as seguintes equações:
Altura das Laterais da Caixa:
$$\text{Altura Lateral} = \text{Altura Total} - \text{Altura do Rodapé}$$
Profundidade Útil da Caixa:
$$\text{Profundidade Lateral} = \text{Profundidade Total} - \text{Espessura da Porta}$$
Comprimento das Bases e Chapéus (Teto):
$$\text{Comprimento Base} = \text{Largura Total} - \left( 2 \times \text{Espessura Lateral} \right)$$
Dimensionamento do Fundo (Rebaixo de $10\text{ mm}$ com encaixe de $6\text{ mm}$ por lado):
$$\text{Comprimento Fundo} = \text{Largura Total} - \left( 2 \times \text{Espessura Lateral} \right) + 12\text{ mm}$$
$$\text{Altura Fundo} = \text{Altura Lateral} + 12\text{ mm}$$
Regra de Seleção de Dobradiças:
$$\text{Quantidade de Dobradiças} = \begin{cases} 2, & \text{se } \text{Altura Porta} \le 1000\text{ mm} \\ 3, & \text{se } 1000\text{ mm} < \text{Altura Porta} \le 1600\text{ mm} \\ 4, & \text{se } 1600\text{ mm} < \text{Altura Porta} \le 2200\text{ mm} \\ 5, & \text{se } \text{Altura Porta} > 2200\text{ mm} \end{cases}$$
4.2 Saída JSON Mapeada com Engenharia de Corte (Fase 2)



JSON
{
  "processamento_engenharia": {
    "id_modulo": 1,
    "aba_planilha_destino": "AI - C divisória compartilhada",
    "parametros_excel": {
      "C4_largura": 1200,
      "C5_altura": 850,
      "C6_profundidade": 600,
      "C8_qtd_portas": 2,
      "C9_qtd_gavetas": 3,
      "C10_qtd_prateleiras": 1,
      "D12_sku_corpo": "MDF-BR-15",
      "D13_sku_frentes": "MDF-LF-18"
    },
    "plano_corte_estimado": [
      { "peca": "Lateral Esquerda", "comprimento_mm": 750, "largura_mm": 582, "qtd": 1, "espessura_mm": 15 },
      { "peca": "Lateral Direita", "comprimento_mm": 750, "largura_mm": 582, "qtd": 1, "espessura_mm": 15 },
      { "peca": "Base Inferior", "comprimento_mm": 1170, "largura_mm": 582, "qtd": 1, "espessura_mm": 15 },
      { "peca": "Divisória Central", "comprimento_mm": 735, "largura_mm": 560, "qtd": 1, "espessura_mm": 15 },
      { "peca": "Frentes de Gaveta", "comprimento_mm": 580, "largura_mm": 240, "qtd": 3, "espessura_mm": 18 },
      { "peca": "Portas de Abrir", "comprimento_mm": 745, "largura_mm": 290, "qtd": 2, "espessura_mm": 18 },
      { "peca": "Fundo do Móvel", "comprimento_mm": 1182, "largura_mm": 762, "qtd": 1, "espessura_mm": 6 }
    ]
  }
}


5. Fase 3: Motor Financeiro e Cálculo de Insumos
5.1 Fórmulas Financeiras e Consumo de Materiais
Cálculo de Área Bruta de MDF ($m^2$):
$$\text{Área Bruta Total } (m^2) = \sum_{i=1}^{n} \left( \frac{\text{Comprimento}_i\text{ (mm)} \times \text{Largura}_i\text{ (mm)}}{1.000.000} \times \text{Quantidade}_i \right)$$
Cálculo de Chapas Inteiras para Compra (com Perda de 20%):
$$\text{Chapas Inteiras} = \left\lceil \frac{\text{Área Bruta Total } (m^2) \times 1.20}{5.06 \, m^2} \right\rceil$$
(Onde $5.06 \, m^2$ é a área útil de uma chapa padrão de $2,75\text{ m} \times 1,84\text{ m}$).
Consumo de Fita de Borda (com Perda de 15%):
$$\text{Metros Lineares Fita} = \left( \sum \text{Perímetro Aplicado (m)} \right) \times 1.15$$
$$\text{Rolos Inteiros (20m)} = \left\lceil \frac{\text{Metros Lineares Fita}}{20} \right\rceil$$
Preço de Venda Comercial (Markup Multiplicador):
$$\text{Preço Final de Venda} = \text{Custo Direto Total de Insumos} \times \text{Markup (2.80)}$$
5.2 Tabela Demonstrativa de Precificação
Insumo / Item
Descrição Técnica
Qtd Bruta
Qtd Comercial
Custo Unit.
Custo Total
MDF
MDF Branco Supremo 15mm
$3.25\text{ m}^2$
1 chapa
R$ 240,00
R$ 240,00
MDF
MDF Louro Freijó 18mm
$2.10\text{ m}^2$
1 chapa
R$ 380,00
R$ 380,00
MDF
MDF Branco 6mm (Fundo)
$0.90\text{ m}^2$
1 chapa
R$ 130,00
R$ 130,00
Fita Borda
Fita PVC Branca 22x0.45mm
$18.5\text{ m}$
1 rolo (20m)
R$ 25,00
R$ 25,00
Fita Borda
Fita PVC Louro Freijó 22x1.0mm
$12.2\text{ m}$
1 rolo (20m)
R$ 45,00
R$ 45,00
Ferragem
Dobradiça Reta Clip-On Amortecedor
4 UN
4 UN
R$ 12,00
R$ 48,00
Ferragem
Corrediça Oculta Slowmotion 500mm
3 PAR
3 PAR
R$ 85,00
R$ 255,00
Acessório
Puxador Perfil Borda Sutil (Metros)
$1.8\text{ m}$
1 barra (3m)
R$ 110,00
R$ 110,00
Fixação
Kit Parafusos / Cola / Cantoneiras
1 KIT
1 KIT
R$ 50,00
R$ 50,00
CUSTO DIRETO
Soma de Materiais Diretos
-
-
-
R$ 1.283,00
PREÇO FINAL
Valor de Venda (Markup 2.80x)
-
-
-
R$ 3.592,40

6. Prompts do Sistema (System Prompts Prontos para Uso)
6.1 PROMPT UNIFICADO DO SISTEMA (System Instructions)



Plaintext
Você é o "Engenheiro e Orçamentista Chefe de Marcenaria Sob Medida", um especialista multimodal responsável por analisar projetos executivos (imagens, PDFs de Promob/SketchUp/AutoCAD, renders ou textos) e transformá-los em ordens de produção e orçamentos comerciais precisos.

Sua base de cálculo e regras operacionais seguem estritamente os parâmetros da "PLANILHA 4.0 PREMIUM".

---

### OBJETIVO E FLUXO DE TRABALHO
Sempre que receber um projeto (imagem, PDF ou texto), você deve executar o processo em 3 FASES AUTOMÁTICAS:

---

### FASE 1: LEITURA E EXTRAÇÃO TÉCNICA (MULTIMODAL)
Analise o arquivo e extraia todas as variáveis técnicas em milímetros (mm).
Se alguma medida ou especificação estiver omitida no projeto, aplique as Recomendações Padrão de Engenharia de Marcenaria:

1. DENSIDADES E ESPESSURAS PADRÃO:
   - Caixaria / Corpo: 15mm (ou 18mm se indicado).
   - Portas e Frentes de Gaveta: 15mm ou 18mm.
   - Fundo do Móvel: 6mm (rebaixo de 10mm).
   - Tamponamento Externo: 18mm ou 25mm engrossado.

2. PROFUNDIDADES NOMINAIS PADRÃO (se omitidas):
   - Armário Inferior de Cozinha (Balcão de Pia): 580mm a 600mm.
   - Armário Superior de Cozinha (Aéreo): 350mm a 380mm.
   - Roupeiro / Closet (Porta de Abrir): 580mm a 600mm.
   - Roupeiro / Closet (Porta de Correr): 650mm (caixa 550mm + 100mm de trilho).
   - Painel de TV / Revestimento: 30mm a 50mm (com travessas de fixação).

3. FERRAGENS E REGRAS CONSTRUTIVAS:
   - Dobradiças por Porta de Abrir: 
     * Altura até 1000mm: 2 dobradiças.
     * Altura de 1001mm a 1600mm: 3 dobradiças.
     * Altura de 1601mm a 2200mm: 4 dobradiças.
     * Altura acima de 2200mm: 5 dobradiças.
   - Corrediças de Gaveta: Profundidade da gaveta = Profundidade da caixa menos 50mm (ex: Caixa de 500mm usa corrediça de 450mm).
   - Puxadores Perfil de Alumínio: Largura da porta/gaveta menos 20mm (para folga de ponteiras).

---

### FASE 2: MAPEAMENTO PARA AS ABAS DA PLANILHA
Classifique cada móvel ou módulo identificado em UMA das abas oficiais do sistema:
- "AI - C divisória compartilhada" (Armário Inferior)
- "AI - Canto L 2 portas"
- " AI - Canto Oblíquo 1 porta"
- "AS - C divisória compartilhada" (Armário Superior)
- "AS - Canto em L 2 portas"
- "AS - Canto Oblíquo 1 porta"
- "Nicho" / "Nicho Engrossado" / "Nicho Adega"
- "Painel Liso" / "Painel Ripado" / "Painel Quadriculado" / "Painel horizontal c frisos"
- "Mesa com Saia"
- "AI - Gavetas horizontal"
- "Armário - Portas de Correr"
- "Armário c rodapé - Portas de Ab"
- "Armário c rodapé - c ou s porta"
- "Tamponamento"

---

### FASE 3: MOTOR DE CÁLCULO E REGRAS FINANCEIRAS

Aplicações Matemáticas Obrigatórias:

1. CÁLCULO DE MDF (Chapas Inteiras):
   - Área Bruta (m²) = ∑ (Comprimento mm × Largura mm / 1.000.000) × Quantidade de Peças.
   - Adicione 20% de margem de perda/corte (Multiplicar área total por 1.20).
   - Área da Chapa Padrão = 5.06 m² (Chapa de 2,75m x 1,84m).
   - Chapas Acompradas = Arredondar para cima (Ceil) da divisão: (Área Bruta × 1.20) / 5.06.

2. CÁLCULO DE FITA DE BORDA:
   - Perímetro Linear (m) = ∑ Perímetro das peças fitadas.
   - Adicione 15% de perda/sobreposição.
   - Arredonde para rolos fechados de 20 metros ou 50 metros.

3. PREÇO FINAL E MARKUP COMERCIAL:
   - Preço de Venda = (Custo Total de Insumos e Materiais Diretos) × Markup (Padrão: 2.80, ou conforme informado pelo usuário).

---

### FORMATO DE RESPOSTA OBRIGATÓRIO

Forneça SEMPRE a resposta estruturada em duas partes:

#### PARTE 1: JSON TÉCNICO E ESTRUTURADO (Para Integração / Sistemas)
Saída em formato JSON válido contendo a estrutura de módulos, especificações e ferragens.

#### PARTE 2: RELATÓRIO COMERCIAL E LISTA DE COMPRAS (Para o Usuário/Cliente)

Exiba em Markdown formatado:

# 📋 PROPOSTA COMERCIAL & MEMORIAL TÉCNICO

### 1. Resumo do Projeto
[Descrição amigável do móvel, ambientes, cores do MDF e acabamentos]

### 2. Lista de Compras Completa (Insumos Diretos)
- **Chapas de MDF:**
  - [Qtd] Chapas de MDF [Cor/Padrão] [Espessura]mm — R$ [Total]
- **Fitas de Borda:**
  - [Qtd] Rolos de Fita PVC [Cor] [Largura]mm — R$ [Total]
- **Ferragens & Acessórios:**
  - [Qtd] Dobradiças [Modelo/Amortecedor] — R$ [Total]
  - [Qtd] Pares de Corrediças [Tipo/Medida] — R$ [Total]
  - [Qtd] Puxadores [Modelo/Medida] — R$ [Total]
- **Kits de Fixação e Insumos:** (Parafusos, cola, cantoneiras, tapa-furos) — R$ [Estimado]

### 3. Consolidado Financeiro
- **Custo Direto de Materiais:** R$ [Valor]
- **Markup Aplicado:** [Ex: 2.8x / 180%]
- **VALOR TOTAL DO ORÇAMENTO:** **R$ [Valor Final]**


7. Script em Python de Integração com o Excel (openpyxl)
O script abaixo carrega o JSON retornado pela IA e escreve os dados diretamente na planilha Excel.



Python
import json
import openpyxl
from openpyxl import load_workbook

def integrar_ia_com_excel(json_dados_path, planilha_excel_path, planilha_saida_path):
    """
    Carrega os dados extraídos pela IA e preenche as células correspondentes no Excel.
    """
    # 1. Carregar o arquivo JSON com os parâmetros
    with open(json_dados_path, 'r', encoding='utf-8') as f:
        dados = json.load(f)
        
    # 2. Carregar a Planilha Excel
    wb = load_workbook(planilha_excel_path, data_only=False)
    
    print(f"Iniciando preenchimento para o cliente: {dados['identificacao']['cliente']}")
    
    # 3. Processar cada módulo extraído
    for mod in dados.get('modulos', []):
        aba_destino = mod.get('aba_destino', 'AI - C divisória compartilhada')
        
        if aba_destino in wb.sheetnames:
            ws = wb[aba_destino]
            dim = mod['dimensoes_finais_mm']
            comp = mod['componentes']
            
            # Preenchimento das Células da Aba Alvo
            ws['C4'] = dim.get('largura', 0)
            ws['C5'] = dim.get('altura', 0)
            ws['C6'] = dim.get('profundidade', 0)
            
            ws['C8'] = comp.get('qtd_portas_abrir', 0)
            ws['C9'] = comp.get('qtd_gavetas', 0)
            ws['C10'] = comp.get('qtd_prateleiras', 0)
            
            print(f"✔ Módulo '{mod['nome_identificador']}' inserido na aba '{aba_destino}'.")
        else:
            print(f"⚠️ Aba '{aba_destino}' não encontrada na planilha Excel.")
            
    # 4. Salvar o arquivo processado
    wb.save(planilha_saida_path)
    print(f"✅ Planilha atualizada com sucesso e salva em: {planilha_saida_path}")

if __name__ == "__main__":
    integrar_ia_com_excel("saida_fase2.json", "_PLANILHA 4.0 PREMIUM - oliveirafariafabio@gmail.com.xlsx", "Orcamento_Final_IA.xlsx")


8. Estudo de Caso Completo (End-to-End)
Projeto de Entrada:
Um cliente envia um croqui técnico de um Armário Aéreo Suspenso:
Dimensões: $1500\text{ mm}$ de largura, $700\text{ mm}$ de altura, $350\text{ mm}$ de profundidade.
Acabamentos: MDF Louro Freijó 18mm no corpo e portas, Fundo 6mm Branco.
Portas: 3 portas de abrir basculantes com pistão a gás e dobradiças com amortecedor.
Resposta e Orçamento Gerados:



JSON
{
  "identificacao": { "cliente": "Fernanda Lima", "ambiente": "Cozinha Aéreo" },
  "modulos": [
    {
      "id_modulo": 1,
      "nome_identificador": "Armário Superior Aéreo",
      "aba_destino": "AS - C divisória compartilhada",
      "dimensoes_finais_mm": { "largura": 1500, "altura": 700, "profundidade": 350 },
      "espessuras_chapas_mm": { "corpo": 18, "portas_frentes": 18, "fundo": 6 },
      "componentes": { "qtd_portas_abrir": 3, "qtd_gavetas": 0, "qtd_prateleiras": 2 }
    }
  ]
}


📋 PROPOSTA COMERCIAL & MEMORIAL TÉCNICO
1. Resumo do Projeto
Móvel: Armário Superior Aéreo Suspenso ($1500 \times 700 \times 350\text{ mm}$).
Materiais: Caixaria e portas em MDF Louro Freijó 18mm, Fundo em MDF Branco 6mm.
Ferragens: 3 basculantes com pistões a gás 80N e dobradiças clip-on com amortecedor.
2. Lista de Compras Completa (Insumos Diretos)
Chapas de MDF:
1 Chapa de MDF Louro Freijó 18mm ($2,75 \times 1,84\text{ m}$) — R$ 380,00
1 Chapa de MDF Branco 6mm para Fundo ($2,75 \times 1,84\text{ m}$) — R$ 130,00
Fitas de Borda:
2 Rolos de Fita PVC Louro Freijó 22x1.0mm (Rolos de 20m) — R$ 90,00
Ferragens & Acessórios:
6 Dobradiças Curvas Clip-On com Amortecedor — R$ 72,00
3 Pistões a Gás 80N — R$ 58,00
Insumos de Fixação: Kit cantoneiras, parafusos, buchas e tapa-furos — R$ 50,00
3. Consolidado Financeiro
Custo Direto de Materiais: R$ 780,00
Markup Comercial Aplicado: 2.80x
VALOR TOTAL DO ORÇAMENTO: R$ 2.184,00



Snippet de código

---

O documento master com todas as fases, schemas, prompts, fórmulas e scripts de integração foi totalmente gerado no editor de documentos ao lado com o título **"Guia Mestre Executivo - IA Orçamentista de Marcenaria"**.

Você pode acessá-lo, editá-lo ou exportá-lo diretamente pela interface! Se precisar de algum ajuste específico nas fórmulas ou na estrutura dos prompts, é só me avisar.


