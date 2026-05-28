Segue o **padrão de identidade visual** do CRM, com base no que está definido no código (principalmente `src/index.css`, `tailwind.config.ts` e telas específicas).

---

## Nome do sistema visual

O projeto usa internamente o conceito **“Bourbon Executive”** com superfícies **“Smoked Obsidian Glass”** (vidro fumê escuro + detalhes dourados), inspirado em tom **mogno / espresso / escritório premium**.

---

## Paleta principal (CRM administrativo)

| Papel | Cor / token | Uso |
|--------|-------------|-----|
| **Fundo base** | `#150c09` + degradês radiais mogno | `body` em `index.css` |
| **Texto principal** | Creme `#f4e4d6` / `#f0e0d2` | `--foreground`, `.text-cream` |
| **Ouro (marca)** | `#d4a853` / `#dbb25a` | Bordas, destaques, sidebar ativa, `.text-gold` |
| **Primary (Tailwind)** | `hsl(43 68% 64%)` ≈ ouro âmbar | Botões primários, `--primary` |
| **Cards / superfícies** | Mogno translúcido `rgba(36,16,8,0.82)` | `.glass-card`, `--card` |
| **Bordas** | `rgba(212, 168, 83, 0.22–0.44)` | Padrão “inlaid gold” |
| **Muted** | `#b8957f` | Textos secundários |
| **Sucesso** | Verde `hsl(142 50% 40%)` | Status positivo |
| **Alerta** | Âmbar `hsl(38 90% 52%)` | Pendências, Financeiro |
| **Erro** | Vermelho `hsl(0 70% 50%)` | Destrutivo |

**Ouro em RGBA (padrão recorrente):** `212, 168, 83` — aparece em bordas, glow, seleção de texto e hovers.

---

## Tipografia

| Uso | Fonte | Pesos |
|-----|--------|--------|
| **Corpo / UI** | **Raleway** | 300, 400, 600, 700 |
| **Títulos de impacto** | **Bebas Neue** (`font-display`) | Display, nomes grandes (ex.: portal do prestador) |

Carregadas em `index.html` via Google Fonts.

**Estilo de texto:**
- Títulos: `font-semibold`, `tracking-tight`
- Labels de seção: `uppercase`, `letter-spacing` largo (0.14em–0.2em), tamanho ~10–11px
- Classe utilitária: `.text-gold`, `.text-gold-muted`, `.text-cream`

---

## Forma e espaçamento

- **Border radius base:** `0.625rem` (`--radius`)
- **Componentes:** Shadcn UI + Radix + Tailwind
- **Modo:** escuro fixo (`color-scheme: dark` no `html`)
- **Mobile-first** (regra de projeto)

---

## Superfícies (glass / mogno)

Classes reutilizáveis em `index.css`:

| Classe | Função |
|--------|--------|
| `.glass-card` | Cards e painéis com blur + borda dourada |
| `.glass-float` | Popovers, dropdowns |
| `.glass-dialog` | Modais |
| `.glass-input` | Campos com foco dourado |
| `.glass-overlay-mogno` | Overlay de modal |
| `.glass-panel` | Painéis refinados |
| `.shadow-mogno` / `.shadow-mogno-lg` | Sombras profundas + highlight interno dourado |
| `.glow-gold` | Aura dourada |
| `.divider-gold` | Linha divisória em degradê |
| `.grain-overlay` | Textura sutil de ruído |

**Header de navegação:** fundo escuro translúcido, blur, linha dourada inferior (`NavigationHeader.tsx`).

**Sidebar:** item ativo com traço vertical dourado, gradiente e `.sidebar-item-active`.

---

## Identidade por área do produto

O CRM **não é 100% homogêneo** — há “sub-marcas” por módulo:

### 1. Admin / Pipeline / geral
- Tema **Bourbon Executive** (mogno + ouro)
- Tokens CSS globais em `:root`

### 2. Financeiro · Pontua Garbo
- Mesmo fundo escuro, com ênfase em **âmbar** e **verde** (`financeiro-styles.ts`)
- Cards: `border-amber-500/35`, textos `text-amber-200/85`
- Comissões / saldo: verde `#4ade80`, ouro `#d4a853`

### 3. Portal do prestador
- Fundo **preto** cinematográfico
- Ouro `#d4a853`, bordas `rgba(212,168,83,…)`.
- Títulos em **Bebas Neue** (`font-display`), animações de entrada
- Logo **Garbo** (`garbo-movelaria-logo.png`)

### 4. Cadastro público (link Carbo)
- Paleta **separada** em `CadastroPublico.tsx`:
  - Chocolate `#2C1403`, `#4A2209`
  - Bege `#C9A07B`, creme `#F5E8D8`
  - Logo `/logo-carbo.jpeg`

### 5. Multi-empresa (white-label parcial)
- Cada empresa pode ter **`cor_primaria`** e **logo** (`EmpresaBrandingForm`)
- Padrão legado ProForco: laranja `#f97316` + logo laranja
- `theme-color` do PWA: `#f5a623`

---

## Ícones e feedback

- **Lucide React** para ícones
- **Toasts:** Sonner
- **Badges:** contorno + fundo semitransparente (âmbar, verde, violeta por tipo de usuário no Admin)

---

## Padrões de UX visual

1. **Dark premium** — pouco branco puro; contraste com creme e ouro  
2. **Vidro escuro + blur** — profundidade, não flat branco  
3. **Dourado = ação / seleção / marca**  
4. **Verde = dinheiro liberado / saque / sucesso financeiro**  
5. **Âmbar = pendente / atenção**  
6. **Popups flutuantes** no canto superior direito, abaixo do header (`floating-ui-layout.ts`)  
7. **Animações suaves** — `animate-in`, `fade-in`, transições 0.2–0.3s  

---

## Resumo em uma frase

> **CRM escuro “mogno + ouro executivo”, tipografia Raleway/Bebas Neue, componentes em vidro fumê com bordas douradas; módulos Financeiro e Prestador reforçam âmbar/verde; cadastros Carbo usam paleta chocolate/bege própria; empresas podem customizar logo e cor primária.**

---

Se quiser, no modo Agent posso montar um **guia de marca em PDF/Markdown** (`docs/identidade-visual.md`) consolidando tokens, exemplos de botões e “do / don’t” para designers.