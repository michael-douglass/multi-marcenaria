-- Migra status legado "Venda Perdida (Não Matriculado)" → "Orçamentos Perdidos"
-- e remove a coluna correspondente do pipeline principal (se existir).

UPDATE emp_garbo.leads
SET status = 'Orçamentos Perdidos',
    atualizado_em = NOW()
WHERE status = 'Venda Perdida (Não Matriculado)';

DELETE FROM emp_garbo.pipeline_custom_stages
WHERE nome = 'Venda Perdida (Não Matriculado)';
