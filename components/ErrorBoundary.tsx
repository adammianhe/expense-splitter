"use client"

import { Component, ErrorInfo, ReactNode } from "react"
import posthog from "posthog-js"

type Props = { children: ReactNode }
type State = { hasError: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    try {
      if (typeof window !== "undefined") {
        posthog.capture("$exception", {
          $exception_message: error.message,
          $exception_type: error.name,
          $exception_stack_trace: error.stack,
          component_stack: errorInfo.componentStack,
        })
      }
    } catch {
      // best effort
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="max-w-sm w-full bg-white border border-gray-200 rounded-2xl p-6 text-center space-y-4">
            <h1 className="text-lg font-bold text-gray-900">Something went wrong</h1>
            <p className="text-sm text-gray-600">The error has been logged. Please refresh.</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-lg bg-black text-white font-medium hover:bg-gray-800 transition"
            >
              Refresh
            </button>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
