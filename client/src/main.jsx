import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'

async function enableMocking() {
    // Start MSW worker in all environments
    // It will check localStorage to decide whether to mock or passthrough
    console.log('[MSW] Initializing worker...')
    const { worker } = await import('./mocks/browser')
    console.log('[MSW] Worker imported, starting...')
    return worker.start({
        onUnhandledRequest: 'bypass', // Let unhandled requests go through
    }).then(() => {
        console.log('[MSW] Worker started successfully')
    }).catch((err) => {
        console.error('[MSW] Worker failed to start:', err)
    })
}

const Root = () => (
    <StrictMode>
        <AuthProvider>
            <App />
        </AuthProvider>
    </StrictMode>
)

enableMocking().then(() => {
    console.log('[MSW] Enabling app render...')
    createRoot(document.getElementById('root')).render(<Root />)
}).catch((err) => {
    console.error('[MSW] Critical error during mocking setup:', err)
    // Render app anyway even if mocking fails
    createRoot(document.getElementById('root')).render(<Root />)
})
