import { Component } from "react";

/**
 * Catches unhandled render errors in the component tree.
 * Without this, any render crash unmounts the entire app and shows a blank screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Unexpected error" };
  }

  componentDidCatch(error, info) {
    // Log to console so it's visible in browser DevTools / Sentry
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <p className="text-2xl mb-2">😕</p>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {this.state.message}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, message: null });
              window.location.reload();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
