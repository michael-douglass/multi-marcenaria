import { useRef, useState, useEffect } from 'react';
import { Camera, Save, Loader2 } from 'lucide-react';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useAtualizarPerfilPrestador, useUploadAvatarPrestador, TIPO_PIX_LABELS, type TipoChavePix } from '@/hooks/usePrestadorPerfil';
import { toast } from 'sonner';

const FIELD_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: 'rgba(255,255,255,0.85)',
  padding: '10px 14px',
  fontSize: 14,
  fontFamily: 'Raleway, sans-serif',
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.2s',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.35)',
  fontFamily: 'Raleway, sans-serif',
  fontWeight: 600,
  marginBottom: 6,
  display: 'block',
};

export function PrestadorPerfil() {
  const { data: profile } = useCurrentUserProfile();
  const atualizar = useAtualizarPerfilPrestador();
  const uploadAvatar = useUploadAvatarPrestador();
  const fileRef = useRef<HTMLInputElement>(null);

  const [telefone, setTelefone] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [tipoChave, setTipoChave] = useState<TipoChavePix>('cpf');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setTelefone(profile.telefone ?? '');
    setChavePix((profile as { chave_pix?: string | null }).chave_pix ?? '');
    setTipoChave(((profile as { tipo_chave_pix?: string | null }).tipo_chave_pix ?? 'cpf') as TipoChavePix);
    setDirty(false);
  }, [profile?.id]);

  const handleSave = () => {
    if (!dirty) return;
    atualizar.mutate(
      { telefone: telefone || null, chave_pix: chavePix || null, tipo_chave_pix: tipoChave },
      { onSuccess: () => setDirty(false) },
    );
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return; }
    if (file.size > 3 * 1024 * 1024) { toast.error('Máximo 3 MB'); return; }
    uploadAvatar.mutate(file);
    e.target.value = '';
  };

  const mark = () => setDirty(true);

  const avatarUrl = profile?.avatar_url;
  const initials = profile?.nome?.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase() ?? '?';

  return (
    <div
      className="relative z-10 flex flex-col gap-6 px-6 md:px-14 py-10"
      style={{ minHeight: 'calc(100dvh - 80px)', overflowY: 'auto', paddingBottom: 120 }}
    >
      {/* Section heading */}
      <div>
        <div className="h-px bg-amber-400/30 mb-5" style={{ width: '2.5rem' }} />
        <h2 className="font-display text-white text-3xl md:text-4xl tracking-wide">Perfil</h2>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 4, letterSpacing: '0.05em' }}>
          Suas informações pessoais
        </p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <div
            className="flex items-center justify-center rounded-full overflow-hidden"
            style={{
              width: 80,
              height: 80,
              background: avatarUrl ? 'transparent' : 'rgba(240,210,140,0.12)',
              border: '1.5px solid rgba(240,210,140,0.3)',
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="font-display text-2xl" style={{ color: '#f2d892' }}>{initials}</span>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadAvatar.isPending}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'rgba(8,8,8,0.9)',
              border: '1px solid rgba(240,210,140,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {uploadAvatar.isPending ? (
              <Loader2 size={12} style={{ color: '#f2d892', animation: 'spin 1s linear infinite' }} />
            ) : (
              <Camera size={12} style={{ color: '#f2d892' }} />
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>

        <div>
          <p className="font-semibold text-white text-base">{profile?.nome ?? '—'}</p>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 2 }}>{profile?.email ?? '—'}</p>
        </div>
      </div>

      {/* Fields */}
      <div className="grid gap-4 max-w-md">
        {/* Email (read-only) */}
        <div>
          <label style={LABEL_STYLE}>E-mail</label>
          <input
            type="email"
            value={profile?.email ?? ''}
            readOnly
            style={{ ...FIELD_STYLE, opacity: 0.5, cursor: 'not-allowed' }}
          />
        </div>

        {/* Phone */}
        <div>
          <label style={LABEL_STYLE}>Telefone</label>
          <input
            type="tel"
            placeholder="(00) 00000-0000"
            value={telefone}
            onChange={(e) => { setTelefone(e.target.value); mark(); }}
            style={FIELD_STYLE}
            onFocus={(e) => { e.target.style.borderColor = 'rgba(240,210,140,0.5)'; }}
            onBlur={(e)  => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          />
        </div>

        {/* PIX */}
        <div>
          <label style={LABEL_STYLE}>Chave PIX</label>
          <div className="flex gap-2">
            <select
              value={tipoChave}
              onChange={(e) => { setTipoChave(e.target.value as TipoChavePix); mark(); }}
              style={{
                ...FIELD_STYLE,
                width: 'auto',
                flexShrink: 0,
                paddingRight: 8,
                cursor: 'pointer',
              }}
            >
              {(Object.entries(TIPO_PIX_LABELS) as [TipoChavePix, string][]).map(([k, v]) => (
                <option key={k} value={k} style={{ background: '#111', color: 'white' }}>{v}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder={tipoChave === 'email' ? 'seu@email.com' : tipoChave === 'telefone' ? '(00) 00000-0000' : 'Sua chave PIX'}
              value={chavePix}
              onChange={(e) => { setChavePix(e.target.value); mark(); }}
              style={{ ...FIELD_STYLE, flex: 1 }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(240,210,140,0.5)'; }}
              onBlur={(e)  => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      {dirty && (
        <button
          onClick={handleSave}
          disabled={atualizar.isPending}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 24px',
            borderRadius: 8,
            background: 'rgba(240,210,140,0.15)',
            border: '1px solid rgba(240,210,140,0.4)',
            color: '#f2d892',
            fontSize: 13,
            fontFamily: 'Raleway, sans-serif',
            fontWeight: 600,
            letterSpacing: '0.08em',
            cursor: 'pointer',
            transition: 'background 0.2s',
            width: 'fit-content',
          }}
        >
          {atualizar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Salvar alterações
        </button>
      )}
    </div>
  );
}
