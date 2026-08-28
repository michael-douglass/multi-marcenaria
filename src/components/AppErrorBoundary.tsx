import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Evita tela branca silenciosa quando algum erro quebra o React. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[App] Erro não tratado:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCache = () => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('crm-selletos')) keysToRemove.push(key);
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignora */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">Não foi possível carregar o CRM</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Ocorreu um erro ao iniciar a aplicação. Tente recarregar ou limpar o cache local.
        </p>
        <p className="max-w-lg break-all rounded-md bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
          {this.state.error.message}
        </p>
        {this.state.error.stack ? (
          <pre className="max-h-48 max-w-2xl overflow-auto whitespace-pre-wrap break-all text-left font-mono text-[10px] text-muted-foreground">
            {this.state.error.stack}
          </pre>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={this.handleReload}>
            Recarregar
          </Button>
          <Button type="button" variant="outline" onClick={this.handleClearCache}>
            Limpar cache e recarregar
          </Button>
        </div>
      </div>
    );
  }
}
