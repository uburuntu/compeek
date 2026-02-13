import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] React render error:', error);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-compeek-bg text-compeek-text p-8">
          <div className="max-w-lg w-full bg-compeek-surface border border-compeek-error/30 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-compeek-error/20 flex items-center justify-center text-compeek-error text-xl font-bold">!</div>
              <div>
                <h1 className="text-lg font-semibold">Something went wrong</h1>
                <p className="text-xs text-compeek-text-dim">A rendering error crashed the UI</p>
              </div>
            </div>
            <div className="bg-compeek-bg rounded-lg p-3 font-mono text-xs text-compeek-error overflow-auto max-h-40">
              {this.state.error?.message || 'Unknown error'}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-compeek-accent text-white text-sm font-medium hover:bg-compeek-accent-bright transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-4 py-2 rounded-lg bg-compeek-bg border border-compeek-border text-sm font-medium hover:border-compeek-accent/50 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
