import { useState, useEffect, useCallback } from 'react'
import SafetyWidget from './SafetyWidget'
import api from '../../lib/api'
import { useToast } from '../../components/ui/ToastProvider'
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
    // value can be a raw number/boolean (from mocks), or an object like { value, safe, threshold } (from real backend)
    const actualValue = (value && typeof value === 'object' && 'value' in value) ? value.value : value
    const isSafe = (value && typeof value === 'object' && 'safe' in value)
        ? value.safe
        : (ok ? ok(actualValue) : null)

    // A missing value means the sensor isn't reporting — make that explicit
    // rather than showing an ambiguous dash.
    const offline = actualValue == null
    return (
        <tr className="safety-cond-row">
            <td className="safety-cond-label">{label}</td>
            <td className={`safety-cond-value${!offline && isSafe === false ? ' safety-cond-value--warn' : ''}${offline ? ' safety-cond-value--offline' : ''}`}>
                {offline ? 'Sensor offline' : fmt(actualValue)}
            </td>
        </tr>
    )
}

function AdminSafety() {
    const [data, setData]       = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError]     = useState(null)
    
    const [thresholds, setThresholds] = useState({
        safety_max_wind_speed: '',
        safety_min_temperature: '',
        safety_max_temperature: '',
        safety_max_humidity: '',
        safety_min_pressure: '',
        safety_max_pressure: '',
        safety_max_dew_point_diff: ''
    })
    const [savingThresholds, setSavingThresholds] = useState(false)
    const { showToast } = useToast()

    const fetchData = useCallback((quiet = false) => {
        if (!quiet) setLoading(true)
        api.get('/api/safety/comprehensive')
            .then(res => { setData(res.data); setError(null); setLoading(false) })
            .catch(err => { if (!quiet) setError(err.response?.status?.toString() || err.message); if (!quiet) setLoading(false) })
    }, [])

    useEffect(() => {
        fetchData()
        const id = setInterval(() => fetchData(true), POLL_MS)

        // Fetch thresholds configuration
        api.get('/api/settings')
            .then(res => {
                setThresholds({
                    safety_max_wind_speed: res.data.safety_max_wind_speed || '25.0',
                    safety_min_temperature: res.data.safety_min_temperature || '-5.0',
                    safety_max_temperature: res.data.safety_max_temperature || '45.0',
                    safety_max_humidity: res.data.safety_max_humidity || '95.0',
                    safety_min_pressure: res.data.safety_min_pressure || '980.0',
                    safety_max_pressure: res.data.safety_max_pressure || '1040.0',
                    safety_max_dew_point_diff: res.data.safety_max_dew_point_diff || '2.0'
                })
            })
            .catch(err => {
                console.error("Failed to load thresholds from system settings:", err)
            })

        return () => clearInterval(id)
    }, [fetchData])

    const handleThresholdChange = (e) => {
        const { name, value } = e.target
        setThresholds(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const handleSaveThresholds = async (e) => {
        e.preventDefault()
        setSavingThresholds(true)
        try {
            await api.put('/api/settings', thresholds)
            showToast({ type: 'success', message: 'Safety thresholds saved successfully.' })
            // Fetch comprehensive data again to trigger immediate recalculations
            fetchData(true)
        } catch (err) {
            showToast({ type: 'error', message: 'Failed to save safety thresholds.' })
        } finally {
            setSavingThresholds(false)
        }
    }

    const conditions = data?.weather_safety?.conditions ?? {}
    const timeSafety = data?.time_safety ?? null

    return (
        <div className="admin-safety">
            <div className="admin-safety-header">
                <h2 className="admin-safety-title">Safety System</h2>
                <p className="admin-safety-desc">Monitor real-time weather conditions and configure safety override thresholds.</p>
            </div>

            <div className="safety-page-content">
                <SafetyWidget />

                <div className="safety-conditions">
                    <div className="safety-cond-header">
                        <h3 className="safety-cond-title">Current Conditions</h3>
                        <span className="safety-cond-updated">
                            {data ? `Updated ${fmtTime(data.last_updated)}` : loading ? 'Loading…' : '—'}
                        </span>
                    </div>

                    {error && <p className="safety-cond-error">{error}</p>}

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

                <div className="safety-conditions safety-conditions--padded">
                    <h3 className="safety-cond-title">Safety Thresholds</h3>
                    <p className="safety-cond-desc">
                        Configure maximum and minimum parameters for safe telescope operations. Exceeding these limits triggers an automatic weather hold.
                    </p>

                    <form onSubmit={handleSaveThresholds} className="safety-thresholds-form">
                        <div className="safety-form-row">
                            <div className="form-group">
                                <label htmlFor="safety_max_wind_speed">Max Wind Speed (km/h)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    id="safety_max_wind_speed"
                                    name="safety_max_wind_speed"
                                    value={thresholds.safety_max_wind_speed}
                                    onChange={handleThresholdChange}
                                    className="settings-input"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="safety_max_humidity">Max Humidity (%)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    id="safety_max_humidity"
                                    name="safety_max_humidity"
                                    value={thresholds.safety_max_humidity}
                                    onChange={handleThresholdChange}
                                    className="settings-input"
                                    required
                                />
                            </div>
                        </div>

                        <div className="safety-form-row">
                            <div className="form-group">
                                <label htmlFor="safety_min_temperature">Min Temperature (°C)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    id="safety_min_temperature"
                                    name="safety_min_temperature"
                                    value={thresholds.safety_min_temperature}
                                    onChange={handleThresholdChange}
                                    className="settings-input"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="safety_max_temperature">Max Temperature (°C)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    id="safety_max_temperature"
                                    name="safety_max_temperature"
                                    value={thresholds.safety_max_temperature}
                                    onChange={handleThresholdChange}
                                    className="settings-input"
                                    required
                                />
                            </div>
                        </div>

                        <div className="safety-form-row">
                            <div className="form-group">
                                <label htmlFor="safety_min_pressure">Min Pressure (hPa)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    id="safety_min_pressure"
                                    name="safety_min_pressure"
                                    value={thresholds.safety_min_pressure}
                                    onChange={handleThresholdChange}
                                    className="settings-input"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="safety_max_pressure">Max Pressure (hPa)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    id="safety_max_pressure"
                                    name="safety_max_pressure"
                                    value={thresholds.safety_max_pressure}
                                    onChange={handleThresholdChange}
                                    className="settings-input"
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="safety_max_dew_point_diff">Min Temp-Dew Point margin (°C)</label>
                            <input
                                type="number"
                                step="0.1"
                                id="safety_max_dew_point_diff"
                                name="safety_max_dew_point_diff"
                                value={thresholds.safety_max_dew_point_diff}
                                onChange={handleThresholdChange}
                                className="settings-input"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="settings-save-btn"
                            disabled={savingThresholds}
                            style={{ alignSelf: 'flex-start', marginTop: '4px' }}
                        >
                            {savingThresholds ? 'Saving...' : 'Save Thresholds'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default AdminSafety
