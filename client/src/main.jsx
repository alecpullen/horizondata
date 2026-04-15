import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

async function enableMocking() {
    // Only enable mocking in development
    if (import.meta.env.DEV) {
        const { worker } = await import('./mocks/browser')
        return worker.start({
            onUnhandledRequest: 'bypass', // Let unhandled requests go through
        })
    }
    return Promise.resolve()
}

enableMocking().then(() => {
    createRoot(document.getElementById('root')).render(
        <StrictMode>
            <App />
        </StrictMode>,
    )
})
