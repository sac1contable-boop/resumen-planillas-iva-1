import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleTryRecover = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const isDomError = this.state.error?.message?.includes('removeChild') ||
                         this.state.error?.message?.includes('Node');

      return (
        <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-xl max-w-md w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto border border-amber-300">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-zinc-950">
                {isDomError ? 'Sincronización de pantalla recuperada' : 'Atención al procesar pantalla'}
              </h2>
              <p className="text-xs text-zinc-600 leading-relaxed">
                {isDomError
                  ? 'Una sincronización del navegador o traducción automática interfirió con la pantalla. Tus datos permanecen resguardados.'
                  : 'Se ha prevenido el bloqueo de la aplicación. Tus datos en memoria y almacenamiento están a salvo.'}
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-left text-[11px] font-mono text-zinc-700 break-words max-h-24 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={this.handleTryRecover}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reanudar Aplicación</span>
              </button>

              <button
                onClick={this.handleReload}
                className="w-full py-2 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>Recargar Página</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
