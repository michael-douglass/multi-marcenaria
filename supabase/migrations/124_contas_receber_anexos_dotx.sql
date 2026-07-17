-- ============================================================
-- GARBO Movelaria — Aceitar Word (.dotx / .docx) em anexos CR
-- Migration 124
-- ============================================================

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
WHERE id = 'movelaria-contas-receber-anexos';
