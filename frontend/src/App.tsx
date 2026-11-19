import { TerminalEmulator } from '@/components/terminal';
import './App.css';

function App() {
    return (
        <div className="flex min-h-screen flex-col bg-gray-950 text-white">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm">
                <div className="mx-auto flex max-w-full items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                            <svg
                                className="h-5 w-5 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                                />
                            </svg>
                        </div>
                        <h1 className="text-xl font-semibold tracking-tight">Terminal</h1>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="rounded bg-gray-800 px-2 py-1 font-mono text-xs">
                            ws://localhost:3000/api/pty
                        </span>
                    </div>
                </div>
            </header>

            {/* Terminal Area */}
            <main className="flex flex-1 overflow-hidden p-4">
                <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col">
                    <TerminalEmulator
                        className="min-h-[calc(100vh-200px)] flex-1"
                        onConnect={() => console.log('[App] Terminal connected')}
                        onDisconnect={() => console.log('[App] Terminal disconnected')}
                        onError={err => console.error('[App] Terminal error:', err)}
                    />
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-gray-800 bg-gray-950/80 px-4 py-3 backdrop-blur-sm">
                <div className="mx-auto flex max-w-6xl items-center justify-between text-xs text-gray-500">
                    <span>Linux Terminal Emulator</span>
                    <span className="flex items-center gap-2">
                        <kbd className="rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-gray-300">
                            Ctrl
                        </kbd>
                        <span>+</span>
                        <kbd className="rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-gray-300">
                            C
                        </kbd>
                        <span className="text-gray-600">to interrupt</span>
                    </span>
                </div>
            </footer>
        </div>
    );
}

export default App;
