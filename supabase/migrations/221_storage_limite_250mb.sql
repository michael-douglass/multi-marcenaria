-- Sobe o teto de upload de 200 MB para 250 MB nos buckets de mídia do CRM
-- (anexos de lead + Biblioteca usam marketing-medias; slides de orçamento usam orcamento-slides).

UPDATE storage.buckets
SET file_size_limit = 262144000 -- 250 MB
WHERE id IN ('marketing-medias', 'orcamento-slides');
