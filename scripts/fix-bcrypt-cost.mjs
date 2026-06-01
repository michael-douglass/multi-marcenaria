/**
 * Recria hash de senha com bcrypt cost 10 (exigido pelo GoTrue do Supabase).
 * Define senha temporária "Garbo@2026" para usuários com hash de cost < 10.
 */
import pkg from 'pg'
const { Client } = pkg
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

const TEMP_PASSWORD = 'Garbo@2026'

// Busca usuários movelaria com senha de cost < 10
const { rows } = await client.query(`
  SELECT mu.id, mu.email
  FROM public.movelaria_usuarios mu
  JOIN auth.users au ON au.id = mu.id
  WHERE au.encrypted_password IS NOT NULL
    AND au.encrypted_password NOT LIKE '$2a$10$%'
`)

console.log('Usuários com cost baixo:', rows.length)

for (const u of rows) {
  // Recria com cost 10 usando extensões pgcrypto
  await client.query(`
    UPDATE auth.users
    SET encrypted_password = extensions.crypt($1, extensions.gen_salt('bf', 10)),
        updated_at = NOW()
    WHERE id = $2::uuid
  `, [TEMP_PASSWORD, u.id])
  console.log('✅ Senha temporária definida para', u.email)
}

// Corrige também a função para futuros usuários
await client.query(`
  CREATE OR REPLACE FUNCTION movelaria_criar_usuario(
    p_email  TEXT,
    p_senha  TEXT,
    p_nome   TEXT    DEFAULT NULL,
    p_perfil TEXT    DEFAULT 'marceneiro'
  )
  RETURNS UUID AS $func$
  DECLARE
    v_id    UUID;
    v_email TEXT := lower(trim(p_email));
  BEGIN
    IF movelaria_meu_perfil() <> 'administrador' THEN
      RAISE EXCEPTION 'Acesso negado';
    END IF;
    IF p_perfil NOT IN ('administrador','financeiro','marceneiro','montador','montador_admin') THEN
      RAISE EXCEPTION 'Perfil inválido: %', p_perfil;
    END IF;
    SELECT id INTO v_id FROM auth.users WHERE lower(email) = v_email;
    IF v_id IS NOT NULL THEN
      INSERT INTO public.movelaria_usuarios (id, email, nome, perfil, ativo)
      VALUES (v_id, v_email, p_nome, p_perfil, true)
      ON CONFLICT (id) DO UPDATE
        SET nome = COALESCE(EXCLUDED.nome, public.movelaria_usuarios.nome),
            perfil = EXCLUDED.perfil, ativo = true, atualizado_em = NOW();
      IF p_senha IS NOT NULL AND p_senha <> '' THEN
        UPDATE auth.users
        SET encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf', 10)),
            updated_at = NOW()
        WHERE id = v_id;
      END IF;
      INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), v_id, v_email, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', NOW(), NOW(), NOW())
      ON CONFLICT (provider, provider_id) DO NOTHING;
    ELSE
      v_id := gen_random_uuid();
      INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
      VALUES (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        v_email, extensions.crypt(p_senha, extensions.gen_salt('bf', 10)),
        NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, false, NOW(), NOW());
      INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), v_id, v_email, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', NOW(), NOW(), NOW());
      INSERT INTO public.movelaria_usuarios (id, email, nome, perfil, ativo)
      VALUES (v_id, v_email, p_nome, p_perfil, true)
      ON CONFLICT (id) DO UPDATE SET nome = p_nome, perfil = p_perfil, ativo = true, atualizado_em = NOW();
    END IF;
    RETURN v_id;
  END;
  $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, auth, public;
`)

// Corrige também movelaria_redefinir_senha
await client.query(`
  CREATE OR REPLACE FUNCTION movelaria_redefinir_senha(p_id UUID, p_senha TEXT)
  RETURNS void AS $func$
  BEGIN
    IF movelaria_meu_perfil() <> 'administrador' THEN
      RAISE EXCEPTION 'Acesso negado';
    END IF;
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf', 10)),
        updated_at = NOW()
    WHERE id = p_id;
  END;
  $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, auth, public;
`)

console.log('\n✅ Funções corrigidas para usar bcrypt cost 10.')
console.log('\n⚠️  Senha temporária "Garbo@2026" foi definida para:')
rows.forEach(u => console.log('   -', u.email))
console.log('\nPeça aos usuários para trocar via Configurações → Redefinir Senha após o primeiro acesso.')

await client.end()
