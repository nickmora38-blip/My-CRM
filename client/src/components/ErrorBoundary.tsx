import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center px-4">
          <div className="bg-exclusive-black-card border border-exclusive-black-border rounded-xl p-8 max-w-md w-full text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-white text-xl font-bold mb-2">Something went wrong</h1>
            <p className="text-gray-400 text-sm mb-6">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            {this.state.error && (
              <p className="text-gray-500 text-xs font-mono mb-6 break-all">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleReset}
              className="bg-exclusive-red hover:bg-exclusive-red-dark text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
