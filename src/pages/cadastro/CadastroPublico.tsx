import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { Loader2, User, Mail, Phone, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { zodFormResolver } from '@/lib/zod-form-resolver';

const carboLogo = '/logo-carbo.jpeg';

// ─── Paleta Carbo ────────────────────────────────────────────────────────────
// Chocolate escuro:  #2C1403
// Chocolate médio:   #4A2209
// Sandy beige:       #C9A07B
// Creme claro:       #F5E8D8

type CadastroTipo = 'prestador' | 'lead' | 'colaborador' | 'marketing';

interface TipoConfig {
  label: string;
  descricao: string;
  badge: string;
  tipoUsuario: 'prestador_servico' | 'lead' | 'colaborador';
  role: 'vendedor' | 'marketing' | 'nenhum';
  icon: string;
}

const TIPOS: Record<CadastroTipo, TipoConfig> = {
  prestador: {
    label: 'Prestador de Serviço',
    descricao: 'Profissionais que prestam serviços especializados',
    badge: 'PRESTADOR',
    tipoUsuario: 'prestador_servico',
    role: 'vendedor',
    icon: '◆',
  },
  lead: {
    label: 'Cliente / Lead',
    descricao: 'Clientes e potenciais parceiros de negócio',
    badge: 'LEAD',
    tipoUsuario: 'lead',
    role: 'nenhum',
    icon: '◈',
  },
  colaborador: {
    label: 'Colaborador & Vendedor',
    descricao: 'Membros da equipe de vendas e operações',
    badge: 'COLABORADOR',
    tipoUsuario: 'colaborador',
    role: 'vendedor',
    icon: '◉',
  },
  marketing: {
    label: 'Marketing',
    descricao: 'Equipe responsável por campanhas e conteúdo',
    badge: 'MARKETING',
    tipoUsuario: 'colaborador',
    role: 'marketing',
    icon: '◎',
  },
};

const schema = z.object({
  nome: z.string().trim().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email: z.string().trim().email('Email inválido'),
  telefone: z.string().optional(),
  senha: z
    .string()
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(128),
  confirmarSenha: z.string(),
}).refine((d) => d.senha === d.confirmarSenha, {
  message: 'As senhas não coincidem',
  path: ['confirmarSenha'],
});

type FormValues = z.infer<typeof schema>;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

export default function CadastroPublico() {
  const { tipo } = useParams<{ tipo: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const empresaId = searchParams.get('e') ?? '';
  const schemaNome = searchParams.get('s') ?? '';
  const hasEmpresaContext = !!empresaId && !!schemaNome;

  const config = TIPOS[tipo as CadastroTipo] ?? TIPOS.prestador;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodFormResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError('');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/register-public`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          nome: values.nome.trim(),
          email: values.email.trim(),
          telefone: values.telefone?.replace(/\D/g, '') || null,
          senha: values.senha,
          tipo_usuario: config.tipoUsuario,
          titulo: config.tipoUsuario === 'prestador_servico' ? 'Arquiteto' : null,
          role: config.role,
          empresaId,
          schemaNome,
        }),
      });
      const data = await res.json().catch(() => ({})) as { success?: boolean; error?: string };
      if (!data.success) throw new Error(data.error ?? 'Erro ao realizar cadastro');
      navigate('/', { replace: true, state: { cadastroSucesso: true } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao realizar cadastro';
      setServerError(msg);
    }
  };

  // ── Formulário ───────────────────────────────────────────────────────────────
  return (
    <PageShell config={config}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Nome */}
          <FieldWrapper label="Nome Completo" error={errors.nome?.message} icon={<User size={16} />}>
            <input
              {...register('nome')}
              type="text"
              placeholder="Seu nome completo"
              style={inputStyle(!!errors.nome)}
              autoComplete="name"
            />
          </FieldWrapper>

          {/* Email */}
          <FieldWrapper label="Email" error={errors.email?.message} icon={<Mail size={16} />}>
            <input
              {...register('email')}
              type="email"
              placeholder="seu@email.com"
              style={inputStyle(!!errors.email)}
              autoComplete="email"
            />
          </FieldWrapper>

          {/* Telefone */}
          <FieldWrapper label="Telefone" error={errors.telefone?.message} icon={<Phone size={16} />} optional>
            <input
              {...register('telefone')}
              type="tel"
              placeholder="(00) 00000-0000"
              style={inputStyle(!!errors.telefone)}
              autoComplete="tel"
            />
          </FieldWrapper>

          {/* Senha */}
          <FieldWrapper label="Senha" error={errors.senha?.message} icon={<Lock size={16} />}>
            <div style={{ position: 'relative' }}>
              <input
                {...register('senha')}
                type={showSenha ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                style={{ ...inputStyle(!!errors.senha), paddingRight: '2.75rem' }}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowSenha(v => !v)}
                style={{
                  position: 'absolute', right: '0.75rem', top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', cursor: 'pointer', color: '#A67C55',
                  display: 'flex', alignItems: 'center',
                }}
                tabIndex={-1}
              >
                {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </FieldWrapper>

          {/* Confirmar Senha */}
          <FieldWrapper label="Confirmar Senha" error={errors.confirmarSenha?.message} icon={<Lock size={16} />}>
            <div style={{ position: 'relative' }}>
              <input
                {...register('confirmarSenha')}
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repita a senha"
                style={{ ...inputStyle(!!errors.confirmarSenha), paddingRight: '2.75rem' }}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                style={{
                  position: 'absolute', right: '0.75rem', top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', cursor: 'pointer', color: '#A67C55',
                  display: 'flex', alignItems: 'center',
                }}
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </FieldWrapper>

          {/* Aviso: link sem contexto de empresa */}
          {!hasEmpresaContext && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: 8,
              background: '#FEF9C3',
              border: '1px solid #FDE047',
              color: '#713F12',
              fontSize: '0.875rem',
            }}>
              <strong>Link incompleto.</strong> Use o link gerado pelo administrador no painel Admin. Este link não possui o contexto da empresa necessário para o cadastro.
            </div>
          )}

          {/* Erro do servidor */}
          {serverError && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: 8,
              background: '#FEE2E2',
              border: '1px solid #FCA5A5',
              color: '#991B1B',
              fontSize: '0.875rem',
            }}>
              {serverError}
            </div>
          )}

          {/* Botão */}
          <button
            type="submit"
            disabled={isSubmitting || !hasEmpresaContext}
            style={{
              width: '100%',
              padding: '0.875rem',
              borderRadius: 10,
              border: 'none',
              background: isSubmitting
                ? '#A67C55'
                : 'linear-gradient(135deg, #4A2209 0%, #2C1403 100%)',
              color: '#F5E8D8',
              fontFamily: '"Jost", "Inter", sans-serif',
              fontSize: '1rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
              marginTop: '0.5rem',
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Cadastrando...
              </>
            ) : (
              <>
                Finalizar Cadastro
                <ArrowRight size={18} />
              </>
            )}
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#A67C55' }}>
            Já tem uma conta?{' '}
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{
                background: 'none', border: 'none',
                color: '#4A2209', fontWeight: 600,
                cursor: 'pointer', textDecoration: 'underline',
                fontSize: '0.8rem',
              }}
            >
              Fazer login
            </button>
          </p>
        </div>
      </form>
    </PageShell>
  );
}

// ─── PageShell ────────────────────────────────────────────────────────────────
function PageShell({ children, config }: { children: React.ReactNode; config: TipoConfig }) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Jost:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        .carbo-input:focus { outline: none; border-color: #C9A07B !important; box-shadow: 0 0 0 3px rgba(201,160,123,0.2); }
        .carbo-input::placeholder { color: #C4A882; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.55s ease forwards; }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(160deg, #F5E8D8 0%, #EDD9C0 40%, #E4CAA8 100%)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '2rem 1rem 4rem',
          fontFamily: '"Jost", "Inter", sans-serif',
        }}
      >
        <div
          className="fade-up"
          style={{
            width: '100%',
            maxWidth: 460,
          }}
        >
          {/* ── Banner Logo ─────────────────────────────────────────────────── */}
          <div
            style={{
              background: 'linear-gradient(135deg, #2C1403 0%, #4A2209 60%, #3B1C0E 100%)',
              borderRadius: '18px 18px 0 0',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Decorative geometric shapes */}
            <div style={{
              position: 'absolute', top: -30, right: -30,
              width: 120, height: 120,
              background: 'rgba(201,160,123,0.08)',
              transform: 'rotate(45deg)',
              borderRadius: 12,
            }} />
            <div style={{
              position: 'absolute', bottom: -20, left: -20,
              width: 80, height: 80,
              background: 'rgba(201,160,123,0.06)',
              transform: 'rotate(45deg)',
              borderRadius: 8,
            }} />

            <img
              src={carboLogo}
              alt="Carbo"
              style={{
                width: 88,
                height: 88,
                objectFit: 'cover',
                borderRadius: '50%',
                border: '3px solid rgba(201,160,123,0.4)',
                position: 'relative',
                zIndex: 1,
              }}
              onError={(e) => {
                // fallback to text logo if image fails
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />

            <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
              <p style={{
                margin: 0,
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: '1.6rem',
                fontWeight: 700,
                color: '#C9A07B',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}>
                Garbo
              </p>
              <p style={{
                margin: '0.25rem 0 0',
                fontSize: '0.7rem',
                color: 'rgba(201,160,123,0.6)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}>
                Sistema de Gestão
              </p>
            </div>

            {/* Badge de categoria */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 1.2rem',
              borderRadius: 100,
              background: 'rgba(201,160,123,0.15)',
              border: '1px solid rgba(201,160,123,0.3)',
              position: 'relative', zIndex: 1,
            }}>
              <span style={{ color: '#C9A07B', fontSize: '0.95rem' }}>{config.icon}</span>
              <span style={{
                color: '#C9A07B',
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}>
                {config.badge}
              </span>
            </div>
          </div>

          {/* ── Card Formulário ──────────────────────────────────────────────── */}
          <div
            style={{
              background: '#FEFAF5',
              borderRadius: '0 0 18px 18px',
              padding: '2rem',
              boxShadow: '0 20px 60px rgba(44,20,3,0.15)',
              border: '1px solid rgba(201,160,123,0.2)',
              borderTop: 'none',
            }}
          >
            <div style={{ marginBottom: '1.75rem' }}>
              <h1
                style={{
                  margin: '0 0 0.35rem',
                  fontFamily: '"Cormorant Garamond", serif',
                  fontSize: '1.65rem',
                  fontWeight: 700,
                  color: '#2C1403',
                  lineHeight: 1.2,
                }}
              >
                {config.label}
              </h1>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#9A7455', lineHeight: 1.5 }}>
                {config.descricao}
              </p>
            </div>

            {/* Separator */}
            <div style={{
              height: 1,
              background: 'linear-gradient(90deg, #C9A07B22, #C9A07B66, #C9A07B22)',
              marginBottom: '1.75rem',
            }} />

            {children}
          </div>

          <p style={{
            textAlign: 'center',
            marginTop: '1.5rem',
            fontSize: '0.72rem',
            color: '#B08055',
            letterSpacing: '0.05em',
          }}>
            © 2026 Garbo · Todos os direitos reservados
          </p>
        </div>
      </div>
    </>
  );
}

// ─── FieldWrapper ─────────────────────────────────────────────────────────────
function FieldWrapper({
  label, error, icon, optional, children,
}: {
  label: string;
  error?: string;
  icon?: React.ReactNode;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <label style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontSize: '0.8rem',
        fontWeight: 600,
        color: '#5C3D1E',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>
        {icon && <span style={{ color: '#C9A07B' }}>{icon}</span>}
        {label}
        {optional && (
          <span style={{ color: '#B08055', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.72rem' }}>
            (opcional)
          </span>
        )}
      </label>
      {children}
      {error && (
        <p style={{ margin: 0, fontSize: '0.775rem', color: '#C0392B' }}>{error}</p>
      )}
    </div>
  );
}

// ─── Input style ──────────────────────────────────────────────────────────────
function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: 9,
    border: `1.5px solid ${hasError ? '#FCA5A5' : '#DFC4A0'}`,
    background: hasError ? '#FFF5F5' : '#FFF9F3',
    fontSize: '0.925rem',
    color: '#2C1403',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    fontFamily: '"Jost", "Inter", sans-serif',
  };
}
