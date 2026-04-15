import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

async function enableMocking() {
    // Start MSW worker in all environments
    // It will check localStorage to decide whether to mock or passthrough
    const { worker } = await import('./mocks/browser')
    return worker.start({
        onUnhandledRequest: 'bypass', // Let unhandled requests go through
    })
}

enableMocking().then(() => {
    createRoot(document.getElementById('root')).render(
        <StrictMode>
            <App />
        </StrictMode>,
    )
})
