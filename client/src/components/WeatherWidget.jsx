import { useEffect, useState, useCallback } from 'react'
import api from '../lib/api'
import './WeatherWidget.css'

const POLL_MS    = 60_000
const TIMEOUT_MS = 10_000

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
    const [status,   setStatus]   = useState(null)
    const [detail,   setDetail]   = useState(null)
    const [loading,  setLoading]  = useState(true)
    const [error,    setError]    = useState(null)
    const [expanded, setExpanded] = useState(false)

    const fetchAll = useCallback(async (signal) => {
        try {
            const opts = { signal, timeout: TIMEOUT_MS }
            // Status is required; detail is optional — settle both independently
            const [statusResult, detailResult] = await Promise.allSettled([
                api.get('/api/safety/status',  opts),
                api.get('/api/safety/weather', opts),
            ])

            if (statusResult.status === 'rejected') throw statusResult.reason

            if (!signal.aborted) {
                setStatus(statusResult.value.data)
                setDetail(detailResult.status === 'fulfilled' ? detailResult.value.data : null)
                setError(null)
            }
        } catch (e) {
            if (!signal.aborted) {
                setError(e.name === 'CanceledError' || e.name === 'AbortError' ? 'Timed out' : 'Unavailable')
            }
        } finally {
            if (!signal.aborted) setLoading(false)
        }
    }, [])

    useEffect(() => {
        const controller = new AbortController()

        fetchAll(controller.signal)
        const id = setInterval(() => fetchAll(controller.signal), POLL_MS)

        return () => { controller.abort(); clearInterval(id) }
    }, [fetchAll])

    const meta   = status ? (STATUS_META[status.status] ?? STATUS_META.UNSAFE) : null
    const nextAt = status?.next_available
        ? new Date(status.next_available).toLocaleTimeString('en-AU', {
              hour: '2-digit', minute: '2-digit',
              timeZone: 'Australia/Melbourne',
          })
        : null

    const conditions    = detail?.conditions ?? null
    const canExpand     = !loading && !error
    const detailMissing = expanded && !conditions

    return (
        <div className="tv-sidebar-section ww-root">

            {/* clickable header row */}
            <button
                className="ww-header"
                onClick={() => setExpanded(e => !e)}
                aria-expanded={expanded}
                disabled={!canExpand}
            >
                <span className="tv-sidebar-label">Conditions</span>
                {canExpand && (
                    <span className={`ww-chevron ${expanded ? 'ww-chevron--open' : ''}`}>›</span>
                )}
            </button>

            {loading && <div className="ww-loading">Checking…</div>}

            {error && !loading && (
                <>
                    <div className="ww-badge ww-badge--error">{error}</div>
                    <button className="ww-retry-btn" onClick={() => {
                        setLoading(true)
                        setError(null)
                        const controller = new AbortController()
                        fetchAll(controller.signal)
                    }}>
                        Retry
                    </button>
                </>
            )}

            {!loading && !error && status && (
                <>
                    <div className={`ww-badge ${meta.className}`}>
                        <span className="ww-dot" />
                        {meta.label}
                    </div>
                    <p className="ww-reason">{status.reason}</p>
                    {nextAt && <p className="ww-next">Opens {nextAt} AEST</p>}

                    {expanded && (
                        <div className="ww-detail">
                            {detailMissing ? (
                                <p className="ww-detail-unavailable">Detail unavailable</p>
                            ) : (
                                <>
                                    {Object.entries(CONDITION_LABELS).map(([key, { label, unit }]) => {
                                        const cond = conditions[key]
                                        if (!cond) return null
                                        const noData = cond.value == null
                                        return (
                                            <div key={key} className="ww-row">
                                                <span className="ww-row-label">{label}</span>
                                                <span className="ww-row-right">
                                                    <span className="ww-row-value">
                                                        {noData ? '-' : fmt(cond.value, unit)}
                                                    </span>
                                                    <span className={`ww-indicator ${noData ? 'ww-indicator--na' : cond.safe ? 'ww-indicator--ok' : 'ww-indicator--fail'}`} />
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
                                </>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
