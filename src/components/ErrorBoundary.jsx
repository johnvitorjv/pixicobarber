import { Component } from 'react';
export default class ErrorBoundary extends Component {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() {
        if (this.state.failed) return <div role="alert" className="min-h-screen bg-black text-white p-12">
            Não foi possível abrir esta página. <button className="underline" onClick={() => window.location.reload()}>Tentar novamente</button>
        </div>;
        return this.props.children;
    }
}
