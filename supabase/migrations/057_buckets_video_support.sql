-- Adiciona suporte a vídeos nos buckets de arquivos de obra
-- Amplia allowed_mime_types e aumenta file_size_limit para suportar vídeos grandes

UPDATE storage.buckets
SET
  allowed_mime_types = array_cat(
    COALESCE(allowed_mime_types, ARRAY[]::text[]),
    ARRAY[
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-msvideo',
      'video/ogg',
      'video/mpeg',
      'video/x-m4v',
      'video/3gpp',
      'video/3gpp2'
    ]
  ),
  file_size_limit = 524288000  -- 500 MB
WHERE name IN ('movelaria-obra-arquivos', 'movelaria-obra-evolucao');
