import { TerminalEmulator } from '@/components/terminal';
import './App.css';

function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto max-w-full px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Terminal</h1>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="px-2 py-1 rounded bg-gray-800 font-mono text-xs">
              ws://localhost:3000/api/pty
            </span>
          </div>
        </div>
      </header>

      {/* Terminal Area */}
      <main className="flex-1 flex overflow-hidden p-4">
        <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col min-h-0">
          <TerminalEmulator
            className="flex-1 min-h-[calc(100vh-200px)]"
            onConnect={() => console.log('[App] Terminal connected')}
            onDisconnect={() => console.log('[App] Terminal disconnected')}
            onError={(err) => console.error('[App] Terminal error:', err)}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-gray-950/80 backdrop-blur-sm px-4 py-3">
        <div className="mx-auto max-w-6xl flex items-center justify-between text-xs text-gray-500">
          <span>Linux Terminal Emulator</span>
          <span className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-300 border border-gray-700">Ctrl</kbd>
            <span>+</span>
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-300 border border-gray-700">C</kbd>
            <span className="text-gray-600">to interrupt</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;