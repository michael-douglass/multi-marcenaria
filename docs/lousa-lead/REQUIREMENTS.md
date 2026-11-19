# REQUIREMENTS — Lousa do card de lead

> Frente: revisão da Lousa do modal de lead (CRM). Plano aprovado em 2026-11-19.
> Ritmo: pair programming — uma tarefa por vez, com aprovação entre cada uma (`TASKS.md`).

## Por quê

A Lousa é usada em visita ao cliente e na obra — muitas vezes no celular ou no tablet, com sinal ruim. Hoje ela:

- oferece um catálogo de objetos/móveis que o time não usa e que polui a barra;
- não tem nenhum teste das ferramentas;
- tem uma fila offline incompleta (traços travam quando o sinal cai, fotos offline perdem os desenhos ao sincronizar, apagar/limpar/nota não ficam salvos);
- tem alvos de toque pequenos e não respeita a safe-area em tela cheia.

## O quê

### R1 — Sem objetos/móveis na lousa do lead
- Sem o botão "Móveis" (grupo MEDIR), sem catálogo, sem prévia e sem a ferramenta `furniture`.
- Móveis já salvos em leads antigos continuam **visíveis, só leitura**: aparecem na foto e no JPEG exportado, podem ser movidos e apagados, mas não têm mais o menu de opções de móvel.
- A lousa de obra e o Ambiente IA não mudam.

### R2 — Todas as ferramentas testadas
Selecionar, Lápis, Linha, Borracha, Texto (tamanho/cor), Retângulo, Elipse, Pontos, Medir, Medir arco (cores), Foto (anexar / tirar / do projeto), Quadro branco, Traço (cor e largura), zoom +/−, enquadrar, desfazer/refazer, apagar último, remover foto, limpar desenhos, notas da foto, salvar nos anexos, tela cheia (abrir/fechar), barra recolher/expandir.
Cada uma: funciona, sem erro de console novo.

### R3 — Uso sem internet (lousa aberta que perde o sinal)
Com o lead aberto, se a internet cair, tudo continua funcionando e aparece na hora:
desenhar, formas, texto, medir, inserir/tirar foto, quadro branco, apagar, limpar, desfazer, mover foto, nota.
Ao voltar o sinal, sincroniza sozinho, na ordem, sem perder vínculo entre foto e desenhos.
A barra mostra o estado: *Offline · N pendentes* / *Sincronizando* / *Tudo salvo*.
Pendentes de uma conta/empresa nunca aparecem nem são enviados por outra; logout limpa o aparelho.
**Fora do escopo:** abrir o app do zero já sem sinal.

### R4 — Responsiva
Viewports-alvo: celular (iPhone 390×844), Samsung Galaxy S (360×800), Samsung Galaxy Tab (800×1280), iPad (820×1180 e 1024×1366, retrato e paisagem), computador (1440×900).
- Alvos de toque ≥ 44×44px em telas de toque.
- Nada cortado ou escondido pela barra/notch/barra do sistema (safe-area).
- Reenquadra ao girar o aparelho.
- Caneta: a palma não desenha; Apple Pencil não duplica traço.
- Mouse: a roda rola o card no modo embutido; zoom com Ctrl/pinça.
- Todos os botões de ferramenta com `aria-label`.

## Critérios de sucesso
- `pnpm build` passa; nenhum erro novo de typecheck nos arquivos tocados.
- Matriz Playwright (5 viewports, online e offline) sem erro de console novo e sem quebra visual.
- Teste manual do humano em iPad e tablet Samsung reais aprovado.
- `security-check` sem achado alto/crítico no diff.

## Ambiente de teste
- Lead de teste: `http://localhost:3091/pipeline?id=39`.
- Supabase é o real: dados criados nos testes são removidos ao fim de cada rodada.
