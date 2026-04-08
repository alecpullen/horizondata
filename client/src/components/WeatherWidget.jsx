import { useEffect, useState } from 'react'
import './WeatherWidget.css'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
const POLL_MS  = 60_000

const STATUS_META = {
    ACTIVE: { label: 'Operational', className: 'ww-badge--active' },
    UNSAFE: { label: 'Weather Hold', className: 'ww-badge--unsafe' },
    CLOSED: { label: 'Closed',       className: 'ww-badge--closed' },
}

export default function WeatherWidget() {
    const [data,    setData]    = useState(null)
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState(null)

    useEffect(() => {
        let active = true

        async function fetchStatus() {
            try {
                const res = await fetch(`${API_BASE}/api/safety/status`)
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const json = await res.json()
                if (active) { setData(json); setError(null) }
            } catch (e) {
                if (active) setError('Unavailable')
            } finally {
                if (active) setLoading(false)
            }
        }

        fetchStatus()
        const id = setInterval(fetchStatus, POLL_MS)
        return () => { active = false; clearInterval(id) }
    }, [])

    const meta   = data ? (STATUS_META[data.status] ?? STATUS_META.UNSAFE) : null
    const nextAt = data?.next_available
        ? new Date(data.next_available).toLocaleTimeString('en-AU', {
              hour:   '2-digit',
              minute: '2-digit',
              timeZone: 'Australia/Melbourne',
          })
        : null

    return (
        <div className="tv-sidebar-section ww-root">
            <div className="tv-sidebar-label">Conditions</div>

            {loading && <div className="ww-loading">Checking…</div>}

            {error && !loading && (
                <div className="ww-badge ww-badge--error">{error}</div>
            )}

            {!loading && !error && data && (
                <>
                    <div className={`ww-badge ${meta.className}`}>
                        <span className="ww-dot" />
                        {meta.label}
                    </div>
                    <p className="ww-reason">{data.reason}</p>
                    {nextAt && (
                        <p className="ww-next">Opens {nextAt} AEST</p>
                    )}
                </>
            )}
        </div>
    )
}
