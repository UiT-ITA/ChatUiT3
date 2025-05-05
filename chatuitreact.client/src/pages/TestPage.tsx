import { useEffect, useState, useCallback, useRef } from 'react';
import { HubConnectionBuilder, LogLevel, HubConnection } from '@microsoft/signalr';
import { useAuth } from '../contexts/AuthContext';

type HubType = 'public' | 'authenticated';

function TestPage() {
    const [messages, setMessages] = useState<string[]>([]);
    const [status, setStatus] = useState("Disconnected");
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState("");
    const [activeHub, setActiveHub] = useState<HubType>('public');
    const { getAccessToken, isAuthenticated } = useAuth();

    // Use ref to store the connection to prevent issues with stale closures
    const connectionRef = useRef<HubConnection | null>(null);

    // Add a flag to track if a connection is already active
    const isConnectingRef = useRef<boolean>(false);

    // Track if handlers have been registered to avoid duplicates
    const handlersRegisteredRef = useRef<boolean>(false);

    // Connect to the selected hub
    const connectToHub = useCallback(async (hubType: HubType) => {
        // Prevent multiple concurrent connection attempts
        if (isConnectingRef.current) {
            setError("Connection attempt already in progress");
            return;
        }

        isConnectingRef.current = true;

        // Properly disconnect existing connection
        if (connectionRef.current) {
            try {
                // Remove event listeners BEFORE stopping the connection
                if (handlersRegisteredRef.current) {
                    connectionRef.current.off("ReceiveMessage");
                    handlersRegisteredRef.current = false;
                }
                await connectionRef.current.stop();
                connectionRef.current = null;
            } catch (err) {
                setError("Error disconnecting from hub");
            }
        }

        setStatus("Connecting...");
        setError(null);

        try {
            let newConnection;

            if (hubType === 'authenticated') {
                const token = await getAccessToken();

                if (!token) {
                    setError("Authentication required to connect to authenticated hub");
                    setStatus("Disconnected");
                    isConnectingRef.current = false;
                    return;
                }

                newConnection = new HubConnectionBuilder()
                    .withUrl('/testAuthHub', {
                        accessTokenFactory: () => token
                    })
                    .configureLogging(LogLevel.Error)
                    .withAutomaticReconnect({
                        nextRetryDelayInMilliseconds: retryContext => {
                            if (retryContext.previousRetryCount === 0) {
                                return 0; // First retry immediately
                            }
                            const delay = Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
                            return delay;
                        }
                    })
                    .build();
            } else {
                newConnection = new HubConnectionBuilder()
                    .withUrl('/testHub')
                    .configureLogging(LogLevel.Error)
                    .withAutomaticReconnect()
                    .build();
            }

            // Set up message handler - make sure it's only added once
            if (!handlersRegisteredRef.current) {
                newConnection.on('ReceiveMessage', (message) => {
                    setMessages(prev => [...prev, message]);
                });
                handlersRegisteredRef.current = true;
            }

            // Set up reconnection handlers
            newConnection.onreconnecting(error => {
                setStatus("Reconnecting...");
                setError(`Connection lost. Reconnecting: ${error ? error.message : 'Unknown error'}`);
            });

            newConnection.onreconnected(connectionId => {
                setStatus("Connected");
                setError(null);
                setMessages(prev => [...prev, `Reconnected with ID: ${connectionId}`]);
            });

            newConnection.onclose(error => {
                setStatus("Disconnected");
                if (error) {
                    setError(`Connection closed with error: ${error.message}`);
                }
            });

            // Start the connection
            await newConnection.start();
            connectionRef.current = newConnection;
            setStatus("Connected");
            setActiveHub(hubType);
            setMessages([`Connected to ${hubType} hub`]); // Clear messages and add connection info

        } catch (err) {
            setStatus("Disconnected");
            setError(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            isConnectingRef.current = false;
        }
    }, [getAccessToken]);

    // Initial connection on component mount - use a proper boolean ref to ensure it only runs once
    const mountedRef = useRef(false);

    useEffect(() => {
        // Only run once on mount, not on every render
        if (!mountedRef.current) {
            mountedRef.current = true;
            connectToHub('public');
        }

        // Cleanup on unmount
        return () => {
            const connection = connectionRef.current;
            if (connection) {
                try {
                    // First remove event listeners, then stop the connection
                    connection.off("ReceiveMessage");
                    handlersRegisteredRef.current = false;
                    connection.stop();
                } catch (err) {
                    // Silently handle error on unmount
                }
            }
        };
    }, [connectToHub]);

    // Send a message
    const sendMessage = async () => {
        if (!message.trim()) return;

        try {
            setError(null);
            const token = await getAccessToken();

            if (!token) {
                setError("Authentication required to send messages");
                return;
            }

            // Use different endpoints depending on hub type
            const endpoint = activeHub === 'authenticated' ? '/api/test/testAuth' : '/api/test/test';

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(message)
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            setMessage("");
        } catch (err) {
            setError(`Failed to send message: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
            <h2>SignalR Hub Test</h2>

            <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                    <button
                        onClick={() => connectToHub('public')}
                        style={{
                            padding: '8px 16px',
                            marginRight: '10px',
                            backgroundColor: activeHub === 'public' ? '#4CAF50' : '#f0f0f0',
                            color: activeHub === 'public' ? 'white' : 'black',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                        }}
                        disabled={isConnectingRef.current}
                    >
                        Public Hub
                    </button>
                    <button
                        onClick={() => connectToHub('authenticated')}
                        disabled={!isAuthenticated || isConnectingRef.current}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: activeHub === 'authenticated' ? '#4CAF50' : '#f0f0f0',
                            color: activeHub === 'authenticated' ? 'white' : 'black',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            opacity: (!isAuthenticated || isConnectingRef.current) ? 0.5 : 1,
                            cursor: (!isAuthenticated || isConnectingRef.current) ? 'not-allowed' : 'pointer'
                        }}
                    >
                        Authenticated Hub
                    </button>
                </div>

                <div>
                    <strong>Current Hub: </strong>
                    <span style={{ fontWeight: 'bold' }}>
                        {activeHub === 'public' ? 'Public' : 'Authenticated'}
                    </span>
                </div>

                <div style={{ marginTop: '8px' }}>
                    <strong>Status: </strong>
                    <span style={{
                        color: status === 'Connected' ? 'green' :
                            status === 'Reconnecting...' ? 'orange' : 'red',
                        fontWeight: 'bold'
                    }}>
                        {status}
                    </span>
                </div>

                {error && <p style={{ color: 'red', margin: '10px 0' }}>{error}</p>}
            </div>

            <div style={{ marginBottom: '20px' }}>
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a message..."
                    style={{ padding: '8px', width: '70%', marginRight: '10px' }}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button
                    onClick={sendMessage}
                    disabled={!isAuthenticated || status !== 'Connected'}
                    style={{ padding: '8px 16px' }}
                >
                    Send
                </button>
            </div>

            {!isAuthenticated && (
                <div style={{ marginBottom: '20px', color: 'orange' }}>
                    <strong>Note:</strong> You need to be logged in to send messages and use the authenticated hub.
                </div>
            )}

            <div>
                <h3>Messages:</h3>
                <div style={{
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    padding: '10px',
                    height: '300px',
                    overflowY: 'auto',
                    textAlign: 'left'
                }}>
                    {messages.length === 0 ? (
                        <p style={{ color: '#999', textAlign: 'center' }}>No messages yet</p>
                    ) : (
                        <ul style={{ listStyleType: 'none', padding: 0 }}>
                            {messages.map((msg, i) => (
                                <li key={i} style={{
                                    padding: '8px',
                                    margin: '5px 0',
                                    backgroundColor: '#f5f5f5',
                                    borderRadius: '4px'
                                }}>
                                    {msg}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

export default TestPage;