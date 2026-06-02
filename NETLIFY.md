# Deploy na Netlify — GARBO Movelaria

## 1. Conectar o repositório

1. Acesse [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Conecte o GitHub/GitLab e escolha este repositório
3. A Netlify detecta automaticamente:
   - **Build command:** `pnpm build`
   - **Publish directory:** `dist`
   - (definidos em `netlify.toml`)

Não é preciso alterar esses campos manualmente se o `netlify.toml` estiver na raiz.

## 2. Variáveis de ambiente (obrigatório)

Em **Site configuration → Environment variables**, adicione:

| Variável | Onde pegar |
|----------|------------|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → API → `anon` / publishable key |

Alternativa (também aceita pelo app):

- `VITE_SUPABASE_PROJECT_ID` + `VITE_SUPABASE_PUBLISHABLE_KEY`

**Não configure na Netlify** (só local/scripts):

- `DATABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Essas chaves são secretas e não entram no frontend.

## 3. Supabase — liberar o domínio

No Supabase: **Authentication → URL Configuration**

- **Site URL:** `https://SEU-SITE.netlify.app`
- **Redirect URLs:** inclua o mesmo domínio (e `http://localhost:3001` para testes locais)

Sem isso, login pode falhar em produção.

## 4. Deploy

Após salvar as variáveis, clique em **Deploy site** (ou faça push na branch conectada).

Cada push na branch principal gera um novo deploy automaticamente.

## 5. Testar localmente como produção

```bash
pnpm build
pnpm preview
```

Abra o endereço que o Vite mostrar (porta 3001).

## 6. Problemas comuns

| Sintoma | Solução |
|---------|---------|
| Build falha “Variáveis do Supabase ausentes” | Configure `VITE_SUPABASE_*` na Netlify e **redeploy** |
| Página 404 ao atualizar `/contas-pagar` | Confirme `netlify.toml` e `public/_redirects` no repositório |
| Login não funciona online | Ajuste Site URL / Redirect URLs no Supabase |
| Build lento | Normal (~2 min); pacote PDF é grande |

## 7. Migrations do banco

O deploy da Netlify **não** roda migrations. No seu computador:

```bash
pnpm migrate
```

(usa `DATABASE_URL` do `.env` local)
