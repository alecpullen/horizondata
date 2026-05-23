import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

async function enableMocking() {
    let mswEnabled = false
    try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'
        const res = await fetch(`${API_URL}/api/settings`)
        if (res.ok) {
            const data = await res.json()
            mswEnabled = data.msw_enabled === 'true'
            console.log('[MSW] Loaded enabled flag from settings API:', mswEnabled)
        } else {
            throw new Error(`Status: ${res.status}`)
        }
    } catch (err) {
        console.warn('[MSW] Failed to load settings from API, falling back to localStorage:', err)
        const stored = localStorage.getItem('msw-enabled')
        mswEnabled = stored === 'true'
    }

    // Persist in localStorage so handlers/components can check synchronously
    localStorage.setItem('msw-enabled', mswEnabled.toString())

    if (!mswEnabled) {
        console.log('[MSW] Mocking is disabled globally')
        return
    }

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
        <App />
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
