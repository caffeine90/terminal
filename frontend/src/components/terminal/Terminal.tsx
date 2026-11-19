import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import '@xterm/xterm/css/xterm.css';
import { cn } from '@/lib/utils';

export interface TerminalProps {
    className?: string;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
}

export function TerminalEmulator({ className, onConnect, onDisconnect, onError }: TerminalProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const reconnectTimeoutRef = useRef<number | null>(null);

    // Get WebSocket URL from environment or infer from current location
    const getWsUrl = useCallback(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = import.meta.env.VITE_API_HOST || window.location.host;
        return `${protocol}//${host}/api/pty`;
    }, []);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const wsUrl = getWsUrl();
        console.log('[Terminal] Connecting to:', wsUrl);

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.binaryType = 'arraybuffer';

            ws.onopen = () => {
                console.log('[Terminal] Connected');
                setIsConnected(true);
                setConnectionError(null);
                onConnect?.();

                // Send initial resize after connection
                if (termRef.current && fitAddonRef.current) {
                    fitAddonRef.current.fit();
                    const term = termRef.current;
                    term.resize(term.cols, term.rows);
                }
            };

            ws.onmessage = event => {
                const data =
                    typeof event.data === 'string'
                        ? event.data
                        : new TextDecoder().decode(event.data);
                termRef.current?.write(data);
            };

            ws.onclose = event => {
                console.log('[Terminal] Disconnected:', event.code, event.reason);
                setIsConnected(false);
                onDisconnect?.();

                // Attempt reconnection after 3 seconds
                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                }
                reconnectTimeoutRef.current = window.setTimeout(() => {
                    console.log('[Terminal] Reconnecting...');
                    connect();
                }, 3000);
            };

            ws.onerror = event => {
                console.error('[Terminal] WebSocket error:', event);
                setConnectionError('Connection failed');
                onError?.(new Error('WebSocket connection failed'));
            };
        } catch (error) {
            console.error('[Terminal] Failed to create WebSocket:', error);
            setConnectionError('Failed to connect');
            onError?.(error as Error);
        }
    }, [getWsUrl, onConnect, onDisconnect, onError]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        wsRef.current?.close(1000, 'Client disconnect');
        wsRef.current = null;
        setIsConnected(false);
    }, []);

    const sendInput = useCallback((data: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'input', data }));
        }
    }, []);

    const resize = useCallback((cols: number, rows: number) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
    }, []);

    // Initialize terminal
    useEffect(() => {
        if (!containerRef.current) return;

        const term = new Terminal({
            cursorBlink: true,
            cursorStyle: 'block',
            fontSize: 14,
            fontFamily: '"JetBrains Mono", "Fira Code", "Monaco", "Consolas", monospace',
            fontWeight: 'normal',
            fontWeightBold: '600',
            lineHeight: 1.2,
            letterSpacing: 0,
            theme: {
                background: '#0d0d0d',
                foreground: '#e0e0e0',
                cursor: '#ffffff',
                cursorAccent: '#0d0d0d',
                black: '#1a1a1a',
                red: '#ff6b6b',
                green: '#69db7c',
                yellow: '#ffd76b',
                blue: '#6bc4ff',
                magenta: '#c792ea',
                cyan: '#6bdfff',
                white: '#e0e0e0',
                brightBlack: '#4a4a4a',
                brightRed: '#ff8787',
                brightGreen: '#85ff92',
                brightYellow: '#fff085',
                brightBlue: '#85dcff',
                brightMagenta: '#d9a9ff',
                brightCyan: '#85ffff',
                brightWhite: '#ffffff',
            },
            scrollback: 10000,
            tabStopWidth: 4,
            screenReaderMode: false,
            allowProposedApi: true,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());
        term.loadAddon(new ClipboardAddon());

        term.open(containerRef.current);
        fitAddon.fit();

        termRef.current = term;
        fitAddonRef.current = fitAddon;

        // Handle terminal input
        term.onData(data => {
            sendInput(data);
        });

        // Handle resize
        const handleResize = () => {
            if (termRef.current && fitAddonRef.current) {
                fitAddonRef.current.fit();
                const term = termRef.current;
                const cols = term.cols;
                const rows = term.rows;
                term.resize(cols, rows);
                resize(cols, rows);
            }
        };

        window.addEventListener('resize', handleResize);
        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(containerRef.current);

        // Connect to backend
        connect();

        return () => {
            window.removeEventListener('resize', handleResize);
            resizeObserver.disconnect();
            disconnect();
            term.dispose();
            termRef.current = null;
            fitAddonRef.current = null;
        };
    }, [connect, disconnect, sendInput, resize]);

    // Focus terminal on click
    const handleClick = useCallback(() => {
        termRef.current?.focus();
    }, []);

    return (
        <div
            ref={containerRef}
            className={cn(
                'relative h-full min-h-[400px] w-full rounded-lg border bg-black',
                'focus-within:ring-2 focus-within:ring-blue-500/50',
                'font-mono antialiased',
                className
            )}
            onClick={handleClick}
            style={{ fontFamily: 'inherit' }}
        >
            {/* Connection status indicator */}
            <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-full border bg-black/80 px-2 py-1 text-xs font-medium backdrop-blur-sm">
                <span
                    className={cn(
                        'h-2 w-2 rounded-full transition-colors',
                        isConnected ? 'bg-green-500' : 'animate-pulse bg-red-500'
                    )}
                />
                <span
                    className={cn('text-white/80', isConnected ? 'text-green-400' : 'text-red-400')}
                >
                    {isConnected ? 'Connected' : 'Connecting...'}
                </span>
            </div>

            {/* Error banner */}
            {connectionError && (
                <div className="absolute top-2 right-2 left-2 z-10 mx-2 rounded border border-red-500/30 bg-red-900/50 px-3 py-2 text-xs text-red-300">
                    {connectionError}
                </div>
            )}

            {/* Terminal canvas is rendered by xterm.js into containerRef */}
        </div>
    );
}

export default TerminalEmulator;
