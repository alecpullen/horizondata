import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SafetyWidget from './SafetyWidget'
import './AdminDashboard.css'

function PendingAccountsCard({ data, loading }) {
    const count  = data?.pending_accounts ?? 0
    const detail = data?.pending_accounts_detail
    const empty  = !loading && count === 0

    return (
        <Link to="/admin/teachers" className="dash-card dash-card--gold">
            <span className="dash-card-title">Pending Accounts</span>
            <div className="dash-card-main">
                <div className="dash-card-left">
                    <span className="dash-dot dash-dot--gold" />
                    <span className="dash-card-value">{loading ? '…' : count}</span>
                </div>
                <span className="dash-card-context">
                    {empty ? 'All clear' : 'Require review'}
                </span>
            </div>
            <span className="dash-card-sub">
                {detail
                    ? `Oldest request: ${detail.oldest_days}d ago`
                    : 'No pending approvals'}
            </span>
            <div className="dash-card-divider" />
            <div className="dash-card-footer">
                {detail ? (
                    <>
                        <span className="dash-card-footer-primary">{detail.oldest_name}</span>
                        <span className="dash-card-footer-meta">{detail.oldest_institution}</span>
                    </>
                ) : (
                    <span className="dash-card-footer-meta">Nothing to review</span>
                )}
            </div>
        </Link>
    )
}

function PendingBookingsCard({ data, loading }) {
    const count  = data?.pending_bookings ?? 0
    const detail = data?.pending_bookings_detail
    const empty  = !loading && count === 0

    return (
        <Link to="/admin/bookings" className="dash-card dash-card--gold">
            <span className="dash-card-title">Pending Bookings</span>
            <div className="dash-card-main">
                <div className="dash-card-left">
                    <span className="dash-dot dash-dot--gold" />
                    <span className="dash-card-value">{loading ? '…' : count}</span>
                </div>
                <span className="dash-card-context">
                    {empty ? 'All confirmed' : 'Awaiting confirmation'}
                </span>
            </div>
            <span className="dash-card-sub">
                {detail
                    ? `Next: ${detail.next_title}`
                    : 'No pending bookings'}
            </span>
            <div className="dash-card-divider" />
            <div className="dash-card-footer">
                {detail ? (
                    <>
                        <span className="dash-card-footer-primary">{detail.next_date}</span>
                        <span className="dash-card-footer-meta">{detail.next_teacher}</span>
                    </>
                ) : (
                    <span className="dash-card-footer-meta">Nothing to confirm</span>
                )}
            </div>
        </Link>
    )
}

function ActiveSessionsCard({ data, loading }) {
    const count  = data?.active_sessions ?? 0
    const detail = data?.active_sessions_detail
    const empty  = !loading && count === 0

    return (
        <Link to="/admin/sessions" className="dash-card dash-card--teal">
            <span className="dash-card-title">Active Sessions</span>
            <div className="dash-card-main">
                <div className="dash-card-left">
                    <span className={'dash-dot dash-dot--teal' + (count > 0 ? ' dash-dot--pulse' : '')} />
                    <span className="dash-card-value">{loading ? '…' : count}</span>
                </div>
                <span className="dash-card-context">
                    {empty ? 'None running' : 'Currently live'}
                </span>
            </div>
            <span className="dash-card-sub">
                {detail
                    ? (detail.total_students > 0
                        ? `${detail.total_students} student${detail.total_students !== 1 ? 's' : ''} connected`
                        : 'No students joined yet')
                    : 'No active sessions'}
            </span>
            <div className="dash-card-divider" />
            <div className="dash-card-footer">
                {detail?.sample_title ? (
                    <>
                        <span className="dash-card-footer-primary">{detail.sample_title}</span>
                        <span className="dash-card-footer-meta">{detail.sample_teacher}</span>
                    </>
                ) : (
                    <span className="dash-card-footer-meta">No sessions running</span>
                )}
            </div>
        </Link>
    )
}

function AdminDashboard() {
    const [data, setData]       = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError]     = useState(null)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        fetch('/api/admin/stats')
            .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })
            .then(json => { if (!cancelled) { setData(json); setLoading(false) } })
            .catch(err => { if (!cancelled) { setError(err.message); setLoading(false) } })
        return () => { cancelled = true }
    }, [])

    return (
        <div className="admin-dashboard">
            <h2 className="admin-dashboard-title">Dashboard</h2>
            {error && <p className="admin-dashboard-error">Could not load stats: {error}</p>}
            <div className="dash-grid">
                <PendingAccountsCard data={data} loading={loading} />
                <PendingBookingsCard  data={data} loading={loading} />
                <ActiveSessionsCard   data={data} loading={loading} />
                <SafetyWidget />
            </div>
        </div>
    )
}

export default AdminDashboard
