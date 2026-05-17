import { useEffect, useState, useCallback } from 'react'
import { useToast } from '../../components/ui/ToastProvider'
import api from '../../lib/api'
import './AdminBookings.css'

const TABS = [
    { key: 'pending',   label: 'Pending'   },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'all',       label: 'All'       },
]

const STATUS_META = {
    pending:   { label: 'Pending',   mod: 'gold'  },
    confirmed: { label: 'Confirmed', mod: 'green' },
    rejected:  { label: 'Rejected',  mod: 'red'   },
    cancelled: { label: 'Cancelled', mod: 'grey'  },
}

function StatusBadge({ status }) {
    const meta = STATUS_META[status] ?? { label: status, mod: 'grey' }
    return <span className={`bk-badge bk-badge--${meta.mod}`}>{meta.label}</span>
}

function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-AU', {
        day: 'numeric', month: 'short', year: 'numeric',
    })
}

function AdminBookings() {
    const { showToast } = useToast()
    const [bookings, setBookings]       = useState([])
    const [loading, setLoading]         = useState(true)
    const [error, setError]             = useState(null)
    const [activeTab, setActiveTab]     = useState('pending')
    const [busyIds, setBusyIds]         = useState(new Set())
    // Rejection drawer state
    const [rejectingId, setRejectingId] = useState(null)
    const [rejectReason, setRejectReason] = useState('')

    useEffect(() => {
        setLoading(true)
        setError(null)
        api.get('/api/admin/bookings')
            .then(res => { setBookings(res.data); setLoading(false) })
            .catch(err => { setError(err.response?.status?.toString() || err.message); setLoading(false) })
    }, [])

    const setBusy = (id, on) => setBusyIds(prev => {
        const s = new Set(prev)
        on ? s.add(id) : s.delete(id)
        return s
    })

    const mutateStatus = (id, status) =>
        setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))

    const handleConfirm = useCallback(async (id) => {
        setBusy(id, true)
        try {
            await api.post(`/api/admin/bookings/${id}/confirm`)
            mutateStatus(id, 'confirmed')
            showToast({ type: 'success', message: 'Booking confirmed.' })
        } catch {
            showToast({ type: 'error', message: 'Could not confirm booking.' })
        } finally { setBusy(id, false) }
    }, [showToast])

    const handleReject = useCallback(async (id) => {
        if (!rejectReason.trim()) {
            showToast({ type: 'error', message: 'Please enter a rejection reason.' })
            return
        }
        setBusy(id, true)
        try {
            await api.post(`/api/admin/bookings/${id}/reject`, { reason: rejectReason.trim() })
            mutateStatus(id, 'rejected')
            setRejectingId(null)
            setRejectReason('')
            showToast({ type: 'success', message: 'Booking rejected.' })
        } catch {
            showToast({ type: 'error', message: 'Could not reject booking.' })
        } finally { setBusy(id, false) }
    }, [rejectReason, showToast])

    const handleCancel = useCallback(async (id, title) => {
        setBusy(id, true)
        try {
            const r = await fetch(`/api/admin/bookings/${id}/cancel`, { method: 'POST' })
            if (!r.ok) throw new Error()
            mutateStatus(id, 'cancelled')
            showToast({ type: 'success', message: `"${title}" cancelled.` })
        } catch {
            showToast({ type: 'error', message: 'Could not cancel booking.' })
        } finally { setBusy(id, false) }
    }, [showToast])

    const openReject = (id) => {
        setRejectingId(id)
        setRejectReason('')
    }

    const counts = TABS.reduce((acc, { key }) => {
        acc[key] = key === 'all'
            ? bookings.length
            : bookings.filter(b => b.status === key).length
        return acc
    }, {})

    const visible = activeTab === 'all'
        ? bookings
        : bookings.filter(b => b.status === activeTab)

    const COL_COUNT = 7

    return (
        <div className="admin-bookings">
            <h2 className="admin-bookings-title">Bookings</h2>

            <div className="bk-tabs">
                {TABS.map(({ key, label }) => (
                    <button
                        key={key}
                        className={'bk-tab' + (activeTab === key ? ' active' : '')}
                        onClick={() => { setActiveTab(key); setRejectingId(null) }}
                    >
                        {label}
                        <span className="bk-tab-count">{counts[key]}</span>
                    </button>
                ))}
            </div>

            {loading && <p className="bk-empty">Loading…</p>}
            {error   && <p className="bk-empty bk-empty--error">Could not load bookings: {error}</p>}

            {!loading && !error && visible.length === 0 && (
                <p className="bk-empty">No bookings in this category.</p>
            )}

            {!loading && !error && visible.length > 0 && (
                <div className="bk-table-wrap">
                    <table className="bk-table">
                        <thead>
                            <tr>
                                <th>Teacher</th>
                                <th>Session title</th>
                                <th>Date &amp; time</th>
                                <th>Target(s)</th>
                                <th>Headless</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map(b => {
                                const busy      = busyIds.has(b.id)
                                const rejecting = rejectingId === b.id

                                return (
                                    <>
                                        <tr key={b.id} className={rejecting ? 'bk-row--rejecting' : ''}>
                                            <td className="bk-cell-teacher">{b.teacherName}</td>
                                            <td className="bk-cell-title">{b.title}</td>
                                            <td className="bk-cell-dt">
                                                <span className="bk-date">{formatDate(b.date)}</span>
                                                <span className="bk-time">{b.time}</span>
                                            </td>
                                            <td className="bk-cell-targets">
                                                {b.targets.map(t => (
                                                    <span key={t} className="bk-target">{t}</span>
                                                ))}
                                            </td>
                                            <td className="bk-cell-headless">
                                                {b.headless
                                                    ? <span className="bk-headless-yes">Yes</span>
                                                    : <span className="bk-headless-no">No</span>
                                                }
                                            </td>
                                            <td><StatusBadge status={b.status} /></td>
                                            <td>
                                                <div className="bk-actions">
                                                    {b.status === 'pending' && (
                                                        <>
                                                            <button
                                                                className="bk-btn bk-btn--confirm"
                                                                disabled={busy || rejecting}
                                                                onClick={() => handleConfirm(b.id)}
                                                            >Confirm</button>
                                                            <button
                                                                className={'bk-btn bk-btn--reject' + (rejecting ? ' active' : '')}
                                                                disabled={busy}
                                                                onClick={() => rejecting ? setRejectingId(null) : openReject(b.id)}
                                                            >{rejecting ? 'Cancel' : 'Reject'}</button>
                                                        </>
                                                    )}
                                                    {b.status === 'confirmed' && (
                                                        <button
                                                            className="bk-btn bk-btn--cancel"
                                                            disabled={busy}
                                                            onClick={() => handleCancel(b.id, b.title)}
                                                        >Cancel</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>

                                        {rejecting && (
                                            <tr className="bk-reject-drawer">
                                                <td colSpan={COL_COUNT}>
                                                    <div className="bk-reject-form">
                                                        <label className="bk-reject-label">
                                                            Rejection reason
                                                        </label>
                                                        <textarea
                                                            className="bk-reject-textarea"
                                                            rows={2}
                                                            placeholder="e.g. Requested time conflicts with maintenance window…"
                                                            value={rejectReason}
                                                            onChange={e => setRejectReason(e.target.value)}
                                                            autoFocus
                                                        />
                                                        <div className="bk-reject-actions">
                                                            <button
                                                                className="bk-btn bk-btn--reject-confirm"
                                                                disabled={busy || !rejectReason.trim()}
                                                                onClick={() => handleReject(b.id)}
                                                            >
                                                                {busy ? 'Rejecting…' : 'Confirm rejection'}
                                                            </button>
                                                            <button
                                                                className="bk-btn bk-btn--ghost"
                                                                disabled={busy}
                                                                onClick={() => setRejectingId(null)}
                                                            >Discard</button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

export default AdminBookings
