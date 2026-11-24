import React from 'react';
import { RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected rendering issue occurred.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('[OUDVIN ErrorBoundary]', error);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#101010] px-4 py-12 text-center text-[#F3EBDD]">
          <div className="w-full max-w-md rounded-lg border border-[#C9A24A]/35 bg-[#171614] p-7">
            <p className="font-display text-2xl font-semibold tracking-[0.2em] text-[#C9A24A]">
              OUDVIN
            </p>
            <h1 className="mt-4 font-display text-2xl font-semibold text-[#F3EBDD]">
              Something Interrupted This Page
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-[#F3EBDD]/70">
              {this.state.errorMessage || 'Please refresh the page to continue exploring OUDVIN Fragrances.'}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-6 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md bg-[#C9A24A] px-6 py-2.5 text-xs font-semibold text-[#101010] hover:bg-[#DFC076]"
            >
              <RefreshCw className="h-4 w-4" />
              Reload OUDVIN
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
