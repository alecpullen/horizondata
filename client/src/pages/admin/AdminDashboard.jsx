import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './AdminDashboard.css'

const STAT_CONFIG = [
    {
        key: 'pending_accounts',
        label: 'Pending Accounts',
        to: '/admin/teachers',
        description: 'Teachers awaiting approval',
        accent: 'gold',
    },
    {
        key: 'pending_bookings',
        label: 'Pending Bookings',
        to: '/admin/bookings',
        description: 'Bookings awaiting confirmation',
        accent: 'gold',
    },
    {
        key: 'active_sessions',
        label: 'Active Sessions',
        to: '/admin/sessions',
        description: 'Sessions currently running',
        accent: 'teal',
    },
    {
        key: 'safety',
        label: 'Safety Status',
        to: '/admin/safety',
        description: 'Telescope safety system',
        accent: 'safety',
    },
]

function safetyAccent(status) {
    if (status === 'ACTIVE') return 'green'
    if (status === 'CLOSED') return 'red'
    return 'grey'
}

function StatCard({ config, data, loading }) {
    const isSafety = config.key === 'safety'
    const raw = data?.[config.key]

    let value = '—'
    let accent = config.accent

    if (!loading && raw !== undefined) {
        if (isSafety) {
            value = raw.status ?? '—'
            accent = safetyAccent(raw.status)
        } else {
            value = raw
        }
    }

    return (
        <Link to={config.to} className={`dash-stat-card dash-stat-card--${accent}`}>
            <span className="dash-stat-value">{loading ? '…' : value}</span>
            <span className="dash-stat-label">{config.label}</span>
            <span className="dash-stat-desc">{config.description}</span>
        </Link>
    )
}

function AdminDashboard() {
    const [data, setData]     = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError]   = useState(null)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        fetch('/api/admin/stats')
            .then(r => {
                if (!r.ok) throw new Error(`${r.status}`)
                return r.json()
            })
            .then(json => { if (!cancelled) { setData(json); setLoading(false) } })
            .catch(err => { if (!cancelled) { setError(err.message); setLoading(false) } })
        return () => { cancelled = true }
    }, [])

    return (
        <div className="admin-dashboard">
            <h2 className="admin-dashboard-title">Dashboard</h2>

            {error && (
                <p className="admin-dashboard-error">Could not load stats: {error}</p>
            )}

            <div className="dash-stat-grid">
                {STAT_CONFIG.map(cfg => (
                    <StatCard key={cfg.key} config={cfg} data={data} loading={loading} />
                ))}
            </div>
        </div>
    )
}

export default AdminDashboard
