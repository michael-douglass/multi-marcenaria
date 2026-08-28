import { isPdfAttachment } from '@/hooks/useLeadPDFs';
import type { LeadPrestadorPermissao } from '@/hooks/useLeadPrestadorPermissoes';

type AnexoLike = {
  id: string;
  tipo?: 'pdf' | 'imagem' | 'video';
  mime_type?: string | null;
};

export function anexoTipo(anexo: AnexoLike): 'pdf' | 'imagem' | 'video' {
  if (anexo.tipo === 'video') return 'video';
  if (anexo.tipo === 'imagem') return 'imagem';
  if (anexo.tipo === 'pdf') return 'pdf';
  if (anexo.mime_type?.startsWith('video/')) return 'video';
  return isPdfAttachment(anexo) ? 'pdf' : 'imagem';
}

export function podeVerAlgumAnexo(perm: LeadPrestadorPermissao): boolean {
  return perm.pode_ver_fotos || perm.pode_ver_pdfs;
}

export function isAnexoVisivelParaPrestador(
  anexo: AnexoLike,
  perm: LeadPrestadorPermissao,
): boolean {
  const tipo = anexoTipo(anexo);
  if ((tipo === 'imagem' || tipo === 'video') && !perm.pode_ver_fotos) return false;
  if (tipo === 'pdf' && !perm.pode_ver_pdfs) return false;
  if (perm.anexos_visiveis === null) return true;
  return perm.anexos_visiveis.includes(anexo.id);
}

export function filtrarAnexosParaPrestador<T extends AnexoLike>(
  anexos: T[],
  perm: LeadPrestadorPermissao,
): T[] {
  return anexos.filter((a) => isAnexoVisivelParaPrestador(a, perm));
}

export function isOrcamentoVisivelParaPrestador(
  orcamentoId: string,
  perm: LeadPrestadorPermissao,
): boolean {
  if (!perm.pode_ver_orcamento) return false;
  if (perm.orcamentos_visiveis === null) return true;
  return perm.orcamentos_visiveis.includes(orcamentoId);
}

export function anexoEstaMarcado(
  anexoId: string,
  anexos: AnexoLike[],
  perm: LeadPrestadorPermissao,
): boolean {
  const item = anexos.find((a) => a.id === anexoId);
  if (!item) return false;
  return isAnexoVisivelParaPrestador(item, perm);
}

export function orcamentoEstaMarcado(
  orcamentoId: string,
  perm: LeadPrestadorPermissao,
): boolean {
  return isOrcamentoVisivelParaPrestador(orcamentoId, perm);
}

export function syncPodeVerAnexos(perm: Pick<LeadPrestadorPermissao, 'pode_ver_fotos' | 'pode_ver_pdfs'>): boolean {
  return perm.pode_ver_fotos || perm.pode_ver_pdfs;
}

/** Ao ligar categoria, mantém null (todas) ou adiciona ids do tipo */
export function anexosVisiveisAoLigarCategoria(
  anexos: AnexoLike[],
  perm: LeadPrestadorPermissao,
  tipo: 'pdf' | 'imagem' | 'video',
  ligado: boolean,
): string[] | null {
  const doTipo = anexos
    .filter((a) => {
      const t = anexoTipo(a);
      if (tipo === 'imagem') return t === 'imagem' || t === 'video';
      return t === tipo;
    })
    .map((a) => a.id);
  const atual = perm.anexos_visiveis;

  if (!ligado) {
    if (atual === null) {
      const outros = anexos
        .filter((a) => {
          const t = anexoTipo(a);
          if (tipo === 'imagem') return t !== 'imagem' && t !== 'video';
          return t !== tipo;
        })
        .filter((a) => isAnexoVisivelParaPrestador(a, perm))
        .map((a) => a.id);
      return outros.length > 0 ? outros : [];
    }
    return atual.filter((id) => !doTipo.includes(id));
  }

  if (atual === null) return null;
  return [...new Set([...atual, ...doTipo])];
}

export function orcamentosVisiveisAoLigar(
  orcamentoIds: string[],
  perm: LeadPrestadorPermissao,
  ligado: boolean,
): string[] | null {
  if (!ligado) return [];
  if (perm.orcamentos_visiveis === null) return null;
  return [...new Set([...perm.orcamentos_visiveis, ...orcamentoIds])];
}

export function toggleAnexoId(
  anexoId: string,
  anexos: AnexoLike[],
  perm: LeadPrestadorPermissao,
): string[] | null {
  const todosIds = anexos.map((a) => a.id);
  const visiveis = idsAnexosEfetivos(anexos, perm);
  const next = visiveis.includes(anexoId)
    ? visiveis.filter((id) => id !== anexoId)
    : [...visiveis, anexoId];

  if (next.length === todosIds.length) return null;
  return next;
}

export function toggleOrcamentoId(
  orcamentoId: string,
  todosIds: string[],
  perm: LeadPrestadorPermissao,
): string[] | null {
  const visiveis = idsOrcamentosEfetivos(todosIds, perm);
  const next = visiveis.includes(orcamentoId)
    ? visiveis.filter((id) => id !== orcamentoId)
    : [...visiveis, orcamentoId];

  if (next.length === todosIds.length) return null;
  return next;
}

function idsAnexosEfetivos(anexos: AnexoLike[], perm: LeadPrestadorPermissao): string[] {
  return anexos.filter((a) => isAnexoVisivelParaPrestador(a, perm)).map((a) => a.id);
}

function idsOrcamentosEfetivos(todosIds: string[], perm: LeadPrestadorPermissao): string[] {
  if (!perm.pode_ver_orcamento) return [];
  if (perm.orcamentos_visiveis === null) return todosIds;
  return perm.orcamentos_visiveis;
}
