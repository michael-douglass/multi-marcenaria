import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ArrowRight, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { zodFormResolver } from '@/lib/zod-form-resolver';
import {
  GARBO_APRESENTACAO_EMPRESA_ID,
  GARBO_APRESENTACAO_IMAGES,
  GARBO_APRESENTACAO_SCHEMA,
} from './garbo-apresentacao-content';
import { GARBO_APRESENTACAO_THEME } from './garbo-apresentacao-theme';
import { GarboCoverImage } from './GarboCoverImage';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

const schema = z
  .object({
    nome: z.string().trim().min(3, 'Informe seu nome completo'),
    email: z.string().trim().email('Email inválido'),
    telefone: z.string().optional(),
    senha: z.string().min(6, 'Mínimo 6 caracteres').max(128),
    confirmarSenha: z.string(),
  })
  .refine((d) => d.senha === d.confirmarSenha, {
    message: 'As senhas não coincidem',
    path: ['confirmarSenha'],
  });

type FormValues = z.infer<typeof schema>;

interface GarboParceriaFormOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function GarboParceriaFormOverlay({ open, onClose }: GarboParceriaFormOverlayProps) {
  const titleId = useId();
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodFormResolver(schema) });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, isSubmitting]);

  useEffect(() => {
    if (!open) {
      setServerError('');
      setSuccess(false);
      setShowSenha(false);
      setShowConfirm(false);
      reset();
    }
  }, [open, reset]);

  if (!open) return null;

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
          tipo_usuario: 'prestador_servico',
          titulo: 'Arquiteto',
          role: 'vendedor',
          empresaId: GARBO_APRESENTACAO_EMPRESA_ID,
          schemaNome: GARBO_APRESENTACAO_SCHEMA,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!data.success) throw new Error(data.error ?? 'Não foi possível concluir o cadastro');
      setSuccess(true);
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Erro ao realizar cadastro');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Atmosfera de oficina */}
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <GarboCoverImage
          src={GARBO_APRESENTACAO_IMAGES.proposta}
          alt=""
          className="h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(115deg, rgba(8,6,4,0.94) 0%, rgba(8,6,4,0.82) 42%, rgba(26,22,18,0.72) 100%)',
          }}
        />
        <div className="absolute inset-0 grain-overlay opacity-50" />
        <div
          className="absolute inset-y-0 left-0 w-24 opacity-[0.14] sm:w-32"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(242,216,146,0.4) 4px, rgba(242,216,146,0.4) 5px)',
          }}
        />
      </div>

      <button
        type="button"
        onClick={onClose}
        disabled={isSubmitting}
        className="fixed right-4 top-4 z-20 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:right-6 sm:top-6"
        style={{ outlineColor: GARBO_APRESENTACAO_THEME.gold }}
        aria-label="Fechar formulário"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>

      <div className="relative z-10 flex min-h-full w-full items-center justify-center px-5 py-16 sm:px-8">
        <div
          className="relative flex max-h-[calc(100dvh-4rem)] w-full max-w-xl flex-col overflow-hidden rounded-sm border border-[rgba(242,216,146,0.22)] shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
          style={{ background: 'rgba(14,11,9,0.88)', backdropFilter: 'blur(18px)' }}
        >
          {/* Filete de madeira no topo */}
          <div
            className="h-1.5 w-full shrink-0"
            style={{
              background:
                'linear-gradient(90deg, #5c3d1e 0%, #c4a882 35%, #f2d892 50%, #c4a882 65%, #5c3d1e 100%)',
            }}
            aria-hidden
          />

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-8 sm:px-9 sm:py-10">
            <p
              className="mb-3 text-[10px] font-semibold uppercase tracking-[0.35em]"
              style={{ color: GARBO_APRESENTACAO_THEME.gold, fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
            >
              Pontua Garbo · Parceria
            </p>

            <h2
              id={titleId}
              className="mb-3 text-[clamp(1.75rem,4vw,2.35rem)] font-light leading-tight text-balance"
              style={{
                fontFamily: GARBO_APRESENTACAO_THEME.fontDisplay,
                color: GARBO_APRESENTACAO_THEME.textPrimary,
              }}
            >
              Entre na oficina
            </h2>

            <p
              className="mb-8 max-w-md text-sm leading-relaxed sm:text-base"
              style={{
                fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
                color: GARBO_APRESENTACAO_THEME.textMuted,
              }}
            >
              Cadastre-se para iniciar a parceria. A Garbo irá entrar em contato com você —
              com a precisão que a madeira exige.
            </p>

            {success ? (
              <div className="space-y-5 text-center" role="status" aria-live="polite">
                <div
                  className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border"
                  style={{
                    borderColor: 'rgba(242,216,146,0.45)',
                    color: GARBO_APRESENTACAO_THEME.gold,
                    boxShadow: '0 0 40px rgba(242,216,146,0.2)',
                  }}
                >
                  <span className="text-2xl" aria-hidden>
                    ◆
                  </span>
                </div>
                <h3
                  className="text-xl font-light"
                  style={{
                    fontFamily: GARBO_APRESENTACAO_THEME.fontDisplay,
                    color: GARBO_APRESENTACAO_THEME.gold,
                  }}
                >
                  Bem-vindo à parceria
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: GARBO_APRESENTACAO_THEME.textMuted }}
                >
                  Recebemos seus dados. A Garbo irá entrar em contato com você em breve.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-8 py-3 text-sm font-semibold tracking-wide transition-transform duration-300 hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
                    background: GARBO_APRESENTACAO_THEME.gold,
                    color: GARBO_APRESENTACAO_THEME.bgBase,
                    outlineColor: GARBO_APRESENTACAO_THEME.gold,
                  }}
                >
                  Fechar
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                <Field
                  label="Nome completo"
                  error={errors.nome?.message}
                  inputProps={{
                    ...register('nome'),
                    type: 'text',
                    autoComplete: 'name',
                    placeholder: 'Como você assina seus projetos',
                  }}
                />
                <Field
                  label="Email"
                  error={errors.email?.message}
                  inputProps={{
                    ...register('email'),
                    type: 'email',
                    autoComplete: 'email',
                    placeholder: 'seu@escritorio.com',
                  }}
                />
                <Field
                  label="Telefone"
                  optional
                  error={errors.telefone?.message}
                  inputProps={{
                    ...register('telefone'),
                    type: 'tel',
                    autoComplete: 'tel',
                    placeholder: '(00) 00000-0000',
                    inputMode: 'tel',
                  }}
                />
                <Field
                  label="Senha"
                  error={errors.senha?.message}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowSenha((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(242,216,146,0.65)] hover:text-[#f2d892]"
                      aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                      tabIndex={-1}
                    >
                      {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                  inputProps={{
                    ...register('senha'),
                    type: showSenha ? 'text' : 'password',
                    autoComplete: 'new-password',
                    placeholder: 'Mínimo 6 caracteres',
                    className: 'pr-11',
                  }}
                />
                <Field
                  label="Confirmar senha"
                  error={errors.confirmarSenha?.message}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(242,216,146,0.65)] hover:text-[#f2d892]"
                      aria-label={showConfirm ? 'Ocultar confirmação' : 'Mostrar confirmação'}
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                  inputProps={{
                    ...register('confirmarSenha'),
                    type: showConfirm ? 'text' : 'password',
                    autoComplete: 'new-password',
                    placeholder: 'Repita a senha',
                    className: 'pr-11',
                  }}
                />

                {serverError && (
                  <div
                    role="alert"
                    className="rounded-sm border border-red-400/40 bg-red-950/50 px-3 py-2.5 text-sm text-red-200"
                  >
                    {serverError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={cn(
                    'mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-sm px-6 text-sm font-semibold tracking-wide',
                    'transition-transform duration-300 hover:scale-[1.01] hover:shadow-[0_0_36px_rgba(242,216,146,0.28)]',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                    'disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100',
                  )}
                  style={{
                    fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
                    background: GARBO_APRESENTACAO_THEME.gold,
                    color: GARBO_APRESENTACAO_THEME.bgBase,
                    outlineColor: GARBO_APRESENTACAO_THEME.gold,
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Abrindo a oficina…
                    </>
                  ) : (
                    <>
                      Conectar ao Pontua Garbo
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </>
                  )}
                </button>

                <p
                  className="pt-1 text-center text-[11px] tracking-wide"
                  style={{ color: 'rgba(255,250,244,0.45)' }}
                >
                  Cadastro de prestador · vinculado à Garbo Movelaria
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  optional?: boolean;
  trailing?: ReactNode;
  inputProps: InputHTMLAttributes<HTMLInputElement> & { className?: string };
}

function Field({ label, error, optional, trailing, inputProps }: FieldProps) {
  const id = useId();
  const { className, ...rest } = inputProps;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: 'rgba(242,216,146,0.85)', fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
      >
        {label}
        {optional && (
          <span className="font-normal normal-case tracking-normal text-[10px] text-white/40">
            (opcional)
          </span>
        )}
      </label>
      <div className="relative">
        <input
          id={id}
          {...rest}
          className={cn(
            'w-full rounded-sm border bg-[rgba(8,6,4,0.55)] px-3.5 py-3 text-sm text-[#fffaf4]',
            'placeholder:text-white/30 transition-[border-color,box-shadow] duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(242,216,146,0.35)]',
            error ? 'border-red-400/60' : 'border-[rgba(242,216,146,0.22)] hover:border-[rgba(242,216,146,0.4)]',
            className,
          )}
          style={{ fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
        />
        {trailing}
      </div>
      {error && (
        <p className="text-xs text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
