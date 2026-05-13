import { useState, useEffect, useCallback } from 'react'
import SafetyWidget from './SafetyWidget'
import './AdminSafety.css'

const POLL_MS = 30000

const CONDITIONS = [
    { key: 'temperature',   label: 'Temperature',    fmt: v => `${v.toFixed(1)} °C`      },
    { key: 'humidity',      label: 'Humidity',       fmt: v => `${v.toFixed(0)} %`        },
    { key: 'pressure',      label: 'Pressure',       fmt: v => `${v.toFixed(0)} hPa`      },
    { key: 'dew_point',     label: 'Dew point',      fmt: v => `${v.toFixed(1)} °C`       },
    { key: 'wind_speed',    label: 'Wind speed',     fmt: v => `${v.toFixed(1)} km/h`     },
    { key: 'rain_detected', label: 'Rain detected',  fmt: v => (v ? 'Yes' : 'No'),
        ok: v => !v },
    { key: 'light_level',   label: 'Light level',    fmt: v => `${v.toFixed(3)} lux`      },
]

function fmtTime(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function ConditionRow({ label, value, fmt, ok }) {
    const display = value == null ? '—' : fmt(value)
    const safe    = ok ? ok(value) : null
    return (
        <tr className="safety-cond-row">
            <td className="safety-cond-label">{label}</td>
            <td className={`safety-cond-value${safe === false ? ' safety-cond-value--warn' : ''}`}>
                {display}
            </td>
        </tr>
    )
}

function AdminSafety() {
    const [data, setData]     = useState(null)
    const [loading, setLoading] = useState(true)

    const fetchData = useCallback((quiet = false) => {
        if (!quiet) setLoading(true)
        fetch('/api/safety/comprehensive')
            .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
            .then(d => { setData(d); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    useEffect(() => {
        fetchData()
        const id = setInterval(() => fetchData(true), POLL_MS)
        return () => clearInterval(id)
    }, [fetchData])

    const conditions = data?.weather_safety?.conditions ?? {}
    const timeSafety = data?.time_safety ?? null

    return (
        <div className="admin-safety">
            <div className="safety-page-grid">
                <div className="safety-page-widget-col">
                    <SafetyWidget />
                </div>

                <div className="safety-conditions">
                    <div className="safety-cond-header">
                        <h3 className="safety-cond-title">Current Conditions</h3>
                        <span className="safety-cond-updated">
                            {data ? `Updated ${fmtTime(data.last_updated)}` : loading ? 'Loading…' : 'No data'}
                        </span>
                    </div>

                    <table className="safety-cond-table">
                        <tbody>
                            {CONDITIONS.map(c => (
                                <ConditionRow
                                    key={c.key}
                                    label={c.label}
                                    value={conditions[c.key] ?? null}
                                    fmt={c.fmt}
                                    ok={c.ok}
                                />
                            ))}
                        </tbody>
                    </table>

                    <div className="safety-cond-divider" />

                    <div className="safety-cond-header safety-cond-header--sub">
                        <h3 className="safety-cond-title">Viewing Window</h3>
                    </div>

                    <table className="safety-cond-table">
                        <tbody>
                            <ConditionRow
                                label="Window active"
                                value={timeSafety?.in_viewing_window ?? null}
                                fmt={v => (v ? 'Yes' : 'No')}
                                ok={v => v}
                            />
                            <ConditionRow
                                label="Server time"
                                value={timeSafety?.current_time ?? null}
                                fmt={fmtTime}
                            />
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default AdminSafety
