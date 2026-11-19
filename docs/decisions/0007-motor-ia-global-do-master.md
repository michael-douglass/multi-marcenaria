# 0007 — O motor de IA do card do lead é da plataforma (chave, modelos e prompts no master) e tem cota por empresa

**Status:** Aceita
**Data:** 2026-11-19

## Contexto
A aba "IA" do card do lead usava chave, modelo e prompt **por empresa** (`crm.pipeline_lead_ai_config`), sem passar pelo bloqueio de plano e sem medir tokens. O admin da empresa chegava a baixar a chave para o navegador.

## Decisão
- "IA no card lead" (`iaCardLead`) é uma **função** do catálogo (ADR 0004): liga/desliga por plano e por empresa em `/master/planos` e na aba Páginas da empresa. Nasce desligada nos planos existentes e em plano novo.
- Um **motor global**, configurado só pelo master em `/master/modelos`: uma chave, modelos de visão/imagem e prompts da Renderização de projetos. A empresa não vê nem edita nada disso.
- A chave fica em `plataforma_ia_segredos`, sem policy para `authenticated`; só a edge function (service role) a lê. O master grava por RPC e só vê o final da chave.
- Tokens são medidos pelas edge functions (`plataforma_ia_uso`). Limite mensal no plano, com sobreposição por empresa. Estourou = **bloqueio duro** (429).
- Empresa sem plano é recusada, salvo liberação explícita em Páginas.
- A "Análise visual" (Íris Sky, Memória) é removida. Tabelas compartilhadas com slides e Markup IA são mantidas.
- Supabase Vault foi descartado: não há precedente no repositório.

## Consequências
- A chave da OpenAI do render deixa de ser da empresa; a chave própria segue valendo para markup e contratos.
- O Markup IA perde o contexto "análise/conhecimento" em leads novos.
- A mudança só aparece à empresa depois de recarregar a página; o servidor é a fonte de verdade.
- Estouro marginal da cota por concorrência é aceito (checa antes, registra depois).
