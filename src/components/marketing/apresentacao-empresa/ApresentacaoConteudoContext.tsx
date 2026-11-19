import { createContext, useContext, type ReactNode } from 'react';
import {
  CONTEUDO_NEUTRO,
  PONTUA_NEUTRO,
  type ApresentacaoConteudo,
  type PontuaConteudo,
} from './apresentacao-conteudo';

export interface ApresentacaoConteudoValor {
  conteudo: ApresentacaoConteudo;
  pontua: PontuaConteudo;
  /** Empresa dona do conteúdo (recebe o cadastro de parceria). Null = desconhecida (sem envio). */
  empresaId: string | null;
  /** Caminho do link público (/apresentacao/:slug). */
  publicPath: string | null;
  /** Prévia do editor: sem envio real do formulário. */
  previa?: boolean;
  /** Nome fantasia e nome do programa ("Pontua X") da empresa dona do conteúdo. */
  nomeEmpresa?: string;
  nomePrograma?: string;
  /** Logo da empresa dona do conteúdo (fundo do Pontua). Null = logo da empresa ativa / padrão. */
  logoUrl?: string | null;
}

// Sem provider (não deve acontecer nas páginas) cai no texto original.
const Ctx = createContext<ApresentacaoConteudoValor>({
  conteudo: CONTEUDO_NEUTRO,
  pontua: PONTUA_NEUTRO,
  empresaId: null,
  publicPath: null,
});

export function ApresentacaoConteudoProvider({ value, children }: { value: ApresentacaoConteudoValor; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConteudoApresentacao(): ApresentacaoConteudoValor {
  return useContext(Ctx);
}
