// src/ErrorBoundary.tsx
import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const CHUNK_RELOAD_KEY = 'gc:chunk-reload-error';

const isDynamicImportError = (error: Error) =>
  /failed to fetch dynamically imported module|importing a module script failed|loading chunk .* failed/i.test(
    error.message || ''
  );

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("REACT ERROR:", error, errorInfo);

    // A deployment changes Vite's hashed chunk names. Reload once to fetch the new index.
    if (isDynamicImportError(error) && sessionStorage.getItem(CHUNK_RELOAD_KEY) !== error.message) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, error.message);
      window.location.reload();
    }
  }

  private reload = () => {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error && isDynamicImportError(this.state.error);
      return (
        <div style={{ padding: 20, color: "red" }}>
          <h2>Erreur dans l'application</h2>
          <p>
            {isChunkError
              ? "La version de l'application vient d'être mise à jour. Le rechargement automatique n'a pas suffi."
              : "Une erreur inattendue s'est produite."}
          </p>
          <pre>{this.state.error?.message}</pre>
          <button onClick={this.reload}>Recharger</button>
        </div>
      );
    }
    return this.props.children;
  }
}