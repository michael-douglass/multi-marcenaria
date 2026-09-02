# Projetos de produção

**Rota:** `/projetos-producao`  
**Página:** `src/pages/ProjetosProducao.tsx`

## Em linguagem simples

Depois que o cliente fecha e alguém **dá entrada** em Cobranças, nascem **duas coisas**:

1. A obra na **Agenda de Obras** (como hoje)
2. Um card em **Projetos de produção** (este quadro)

Os dois andam **em paralelo**. Mover colunas aqui **não** muda a Agenda de Obras.

## Quem vê

| Papel | Vê? |
|-------|-----|
| Projetista / Projetista Admin (CRM) | sim |
| Vendedor / Admin CRM | sim |
| Montador Admin | sim |
| Montador comum | **não** |
| Admin Obras (só casa) | não (salvo se também for CRM acima) |

## Colunas padrão

1. Projetos de produção pendentes  
2. Projeto iniciado  
3. Projetos concluídos  

É possível **adicionar / editar / reordenar** colunas (projetista admin, admin CRM, Montador Admin).

## Ações

- **Iniciar** → coluna “Projeto iniciado”  
- **Concluir** → coluna “Projetos concluídos”  
- Arrastar entre colunas  
- Busca: **Neste quadro** | **Todos os leads**

## Chat dual

No card → **Conversas**:

- **Projetista de vendas** (ouro) — mesmo fio do ateliê (`lead_projeto_notas`)
- **Projetista de obras** (teal) — canal da oficina (`obra_producao_notas`)

## Tabelas

- `emp_garbo.producao_stages`
- `emp_garbo.obra_producao`
- `emp_garbo.obra_producao_notas`

Criação automática: `movelaria_criar_obra_de_orcamento` chama `movelaria_criar_obra_producao`.

## Adicionar lead manualmente

Botão **Adicionar lead** na página:

1. Busca em todos os leads do CRM
2. **Puxar** chama `movelaria_puxar_lead_producao`
3. Card nasce em **Projetos de produção pendentes**
4. Se o lead já tiver obra (`origem_lead_id`), vincula; senão, `obra_id` fica nulo
5. Se já estiver no quadro, só avisa
