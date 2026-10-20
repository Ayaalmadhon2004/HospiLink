import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '../utils/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('Unhandled UI error:', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        role="alert"
        className="min-h-screen flex items-center justify-center bg-gray-50 p-4"
      >
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-500 text-sm mb-6">
            An unexpected error occurred. Reloading the page usually fixes it.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="bg-teal-500 text-white px-5 py-2.5 rounded-lg hover:bg-teal-600 transition font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
