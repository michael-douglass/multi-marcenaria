# Pontua — interface predefinida pelo master (tarefas)

Plano completo: ver REQUIREMENTS.md e DESIGN.md nesta pasta. Execução em pair-to-peer.

- [x] **T01** Parar o loop de "Carregando perfil..." e o vazamento de contextos WebGL
  - `src/hooks/useEmpresaAtiva.ts`: `empresaLoading` só liga na 1ª carga ou na troca de usuário (refresh vira silencioso); `setEmpresa` mantém a identidade se nada mudou.
  - `src/pages/Prestador.tsx`: refresh da empresa uma vez por montagem (`useRef`).
  - `src/contexts/EmpresaContext.tsx`: `trocarEmpresa`, `limparEmpresaAtiva` e `recarregarEmpresa` estáveis (`useCallback`).
  - `PontuaPointsScene.tsx`: `renderer.forceContextLoss()` no cleanup.
- [x] **T02** Hero `#pontua` sem marca
  - `apresentacao-conteudo.ts`: `PontuaConteudo.interface` (`sem_marca` padrão | `classica`), `PONTUA_INTERFACES`, `resolverPontua`.
  - `ApresentacaoPontua.tsx`: logo do globo só na interface `classica`.
  - Editores (`PontuaEditorPage`, `ApresentacaoEditorPage`) usam `resolverPontua`.
- [x] **T03** Migration `20261119130000_pontua_interface_modelo.sql` + teste T59 em `scripts/multi-empresa/test-plataforma.sql`
  - `master_definir_pontua_interface`, `plataforma_copiar_pontua` (leva só a chave `interface` a quem já tem conteúdo), `master_listar_modelos` (expõe a interface).
  - **Aplicar no banco: pendente** (`pnpm migrate`, manual).
- [x] **T04** Hook `useDefinirPontuaInterface` e textos do catálogo (`modelos-ui.ts`)
- [x] **T05** UI em `/master/modelos`: botão "Interface…", `PontuaInterfaceDialog` e `PontuaInterfacePreview` (lazy)
- [ ] **T06** Verificação visual em 375, 768 e 1440 px (pendente: precisa de sessão logada)

## Verificação feita
- `pnpm build`: ok.
- Typecheck dos arquivos tocados: sem erros novos (restam 3 preexistentes: `ApresentacaoHero.tsx:31`, `GerenciamentoEmpresas.tsx:113`, `Prestador.tsx:114`).
- SQL: migration + teste T59 rodados na mesma transação, com ROLLBACK, sem exceções.

## Desvio do plano
A pré-visualização não tem alternância desktop/mobile: os breakpoints do Tailwind seguem a janela do navegador, não a caixa da prévia, então um "mobile" dentro da página mostraria o layout desktop. A prévia mostra o desktop em escala.
