-- M31 (correção) — Histórico de transações grava a empresa do próprio registro e é pulado quando a empresa
-- inteira está sendo apagada (cascade). Achado pelo teste de isolamento (scripts/multi-empresa/test-isolamento.mjs).
CREATE OR REPLACE FUNCTION public.movelaria_registrar_historico_transacao()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_email TEXT;
  v_registro_id UUID;
  v_empresa_id UUID;
BEGIN
  v_empresa_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.empresa_id ELSE NEW.empresa_id END;
  -- Empresa sendo excluída (cascade): não há onde registrar o histórico.
  IF NOT EXISTS (SELECT 1 FROM "CRM-multi-empresas>empresas<" e WHERE e.id = v_empresa_id) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM movelaria_usuarios WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_registro_id := OLD.id;
  ELSE
    v_registro_id := NEW.id;
  END IF;

  INSERT INTO movelaria_transacoes_historico (
    empresa_id, tabela_origem, registro_id, acao, dados_antes, dados_depois, usuario_id, usuario_email
  ) VALUES (
    v_empresa_id,
    TG_TABLE_NAME,
    v_registro_id,
    lower(TG_OP),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    v_user_id,
    v_user_email
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;
