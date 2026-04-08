import { useEffect, useState } from 'react'
import './WeatherWidget.css'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
const POLL_MS  = 60_000

const STATUS_META = {
    ACTIVE: { label: 'Operational', className: 'ww-badge--active' },
    UNSAFE: { label: 'Weather Hold', className: 'ww-badge--unsafe' },
    CLOSED: { label: 'Closed',       className: 'ww-badge--closed' },
}

const CONDITION_LABELS = {
    temperature:    { label: 'Temperature', unit: '°C' },
    humidity:       { label: 'Humidity',    unit: '%' },
    pressure:       { label: 'Pressure',    unit: ' hPa' },
    dew_point_diff: { label: 'Dew margin',  unit: '°C' },
    wind_speed:     { label: 'Wind',        unit: ' km/h' },
}

function fmt(value, unit) {
    if (value == null) return '—'
    return `${Number(value).toFixed(1)}${unit}`
}

export default function WeatherWidget() {
    const [status,    setStatus]    = useState(null)
    const [detail,    setDetail]    = useState(null)
    const [loading,   setLoading]   = useState(true)
    const [error,     setError]     = useState(null)
    const [expanded,  setExpanded]  = useState(false)

    useEffect(() => {
        let active = true

        async function fetchAll() {
            try {
                const [statusRes, detailRes] = await Promise.all([
                    fetch(`${API_BASE}/api/safety/status`),
                    fetch(`${API_BASE}/api/safety/weather`),
                ])
                if (!statusRes.ok) throw new Error(`HTTP ${statusRes.status}`)

                const statusJson = await statusRes.json()
                const detailJson = detailRes.ok ? await detailRes.json() : null

                if (active) {
                    setStatus(statusJson)
                    setDetail(detailJson)
                    setError(null)
                }
            } catch (e) {
                if (active) setError('Unavailable')
            } finally {
                if (active) setLoading(false)
            }
        }

        fetchAll()
        const id = setInterval(fetchAll, POLL_MS)
        return () => { active = false; clearInterval(id) }
    }, [])

    const meta   = status ? (STATUS_META[status.status] ?? STATUS_META.UNSAFE) : null
    const nextAt = status?.next_available
        ? new Date(status.next_available).toLocaleTimeString('en-AU', {
              hour: '2-digit', minute: '2-digit',
              timeZone: 'Australia/Melbourne',
          })
        : null

    const conditions = detail?.conditions ?? null

    return (
        <div className="tv-sidebar-section ww-root">

            {/* clickable header row */}
            <button
                className="ww-header"
                onClick={() => setExpanded(e => !e)}
                aria-expanded={expanded}
                disabled={loading || !!error}
            >
                <span className="tv-sidebar-label">Conditions</span>
                {!loading && !error && (
                    <span className={`ww-chevron ${expanded ? 'ww-chevron--open' : ''}`}>›</span>
                )}
            </button>

            {loading && <div className="ww-loading">Checking…</div>}

            {error && !loading && (
                <div className="ww-badge ww-badge--error">{error}</div>
            )}

            {!loading && !error && status && (
                <>
                    <div className={`ww-badge ${meta.className}`}>
                        <span className="ww-dot" />
                        {meta.label}
                    </div>
                    <p className="ww-reason">{status.reason}</p>
                    {nextAt && <p className="ww-next">Opens {nextAt} AEST</p>}

                    {/* expanded detail panel */}
                    {expanded && conditions && (
                        <div className="ww-detail">
                            {Object.entries(CONDITION_LABELS).map(([key, { label, unit }]) => {
                                const cond = conditions[key]
                                if (!cond) return null
                                const safe = cond.safe
                                const noData = cond.value == null
                                return (
                                    <div key={key} className="ww-row">
                                        <span className="ww-row-label">{label}</span>
                                        <span className="ww-row-right">
                                            <span className="ww-row-value">
                                                {noData ? '—' : fmt(cond.value, unit)}
                                            </span>
                                            <span className={`ww-indicator ${noData ? 'ww-indicator--na' : safe ? 'ww-indicator--ok' : 'ww-indicator--fail'}`} />
                                        </span>
                                    </div>
                                )
                            })}
                            {detail.timestamp && (
                                <p className="ww-updated">
                                    Updated {new Date(detail.timestamp).toLocaleTimeString('en-AU', {
                                        hour: '2-digit', minute: '2-digit',
                                        timeZone: 'Australia/Melbourne',
                                    })}
                                </p>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
