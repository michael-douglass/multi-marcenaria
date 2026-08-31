/** Pedido para abrir uma foto do card na lousa (mesmo lead). */
export const LEAD_WHITEBOARD_IMPORT_EVENT = 'selletos:lead-whiteboard-import';

export interface LeadWhiteboardImportDetail {
  leadId: number;
  fileUrl: string;
  fileName: string;
  folderId?: string | null;
  folderName?: string | null;
}

export function requestLeadWhiteboardImport(detail: LeadWhiteboardImportDetail): void {
  window.dispatchEvent(new CustomEvent(LEAD_WHITEBOARD_IMPORT_EVENT, { detail }));
}
