-- Migration 165: documentos de funcionário — até 100 MB por arquivo
-- O limite anterior (15 MB) rejeitava PDFs escaneados com HTTP 400.

UPDATE storage.buckets
SET file_size_limit = 104857600 -- 100 MB
WHERE id = 'movelaria-funcionario-documentos';
