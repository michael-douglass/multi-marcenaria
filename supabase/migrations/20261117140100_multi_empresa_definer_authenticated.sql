-- M09 (ajuste) — o postgres não tem GRANT OPTION no schema auth; as funções re-atribuídas chamam
-- auth.uid() direto. app_tenant_definer passa a ser membro de authenticated: herda USAGE em auth e os
-- grants de tabela, e continua SEM BYPASSRLS (as policies TO authenticated somam-se à tenant_definer).
grant authenticated to app_tenant_definer;
