import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-void flex flex-col items-center justify-center p-10 text-center font-sans">
          <div className="w-20 h-20 rounded-pill bg-earth-gray/10 border border-mist flex items-center justify-center mb-10">
            <AlertCircle size={32} className="text-stone-gray" />
          </div>
          
          <h1 className="text-[56px] font-normal text-parchment leading-tight tracking-[-1.12px] mb-6 max-w-2xl">
            System pulse interrupted.
          </h1>
          
          <p className="text-[20px] text-ash-gray mb-12 leading-relaxed max-w-xl">
            A critical error has occurred within the void. Our sensors have logged the disturbance.
          </p>

          <div className="bg-earth-gray/10 border border-mist rounded-comfortable p-6 mb-12 max-w-2xl w-full text-left overflow-auto max-h-[200px]">
             <span className="text-[11px] font-bold text-stone-gray uppercase tracking-editorial block mb-3">Diagnostic Context</span>
             <code className="text-[14px] font-mono text-ash-gray/60 break-all leading-relaxed whitespace-pre-wrap">
               {this.state.error?.name}: {this.state.error?.message}
             </code>
          </div>

          <button
            onClick={this.handleReset}
            className="px-10 py-5 bg-parchment text-void rounded-pill font-bold text-[18px] hover:brightness-90 transition-all flex items-center gap-3 mx-auto shadow-none"
          >
            <RefreshCw size={20} />
            Recalibrate System
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
