-- Permite salvar perfil visualizador na tabela de usuários

ALTER TABLE movelaria_usuarios
  DROP CONSTRAINT IF EXISTS movelaria_usuarios_perfil_check;

ALTER TABLE movelaria_usuarios
  ADD CONSTRAINT movelaria_usuarios_perfil_check
  CHECK (perfil IN (
    'administrador', 'financeiro', 'marceneiro', 'montador',
    'montador_admin', 'administrador_obras', 'visualizador'
  ));
