import React from 'react'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    if (this.props.onReset) {
      this.props.onReset()
    } else {
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-xl mx-auto my-12 bg-white rounded-2xl border border-red-100 shadow-xl text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center border border-red-200">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-600 mb-4">
            An unexpected error occurred while displaying this section. Please try refreshing or returning to the home screen.
          </p>
          {this.state.error && (
            <div className="text-left bg-red-50/80 border border-red-200 rounded-xl p-3 mb-6 text-xs font-mono text-red-700 overflow-x-auto max-h-48">
              <div className="font-bold">{this.state.error.name}: {this.state.error.message}</div>
              {this.state.error.stack && (
                <pre className="text-[10px] text-red-600/80 mt-1.5 whitespace-pre-wrap">{this.state.error.stack}</pre>
              )}
            </div>
          )}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition flex items-center gap-2"
            >
              <RefreshCw size={15} />
              <span>Retry</span>
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 transition flex items-center gap-2"
            >
              <Home size={15} />
              <span>Go to Home</span>
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
