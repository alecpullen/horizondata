import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import CaptureCard from '../components/CaptureCard'
import api from '../lib/api'
import './Captures.css'
import './BookingCaptures.css'

function SkeletonCard() {
    return (
        <div className="cap-card cap-card--skeleton">
            <div className="cap-thumb-skel" />
            <div className="cap-main">
                <div className="cap-skel cap-skel--title" />
                <div className="cap-skel cap-skel--sub" />
                <div className="cap-skel cap-skel--sub cap-skel--short" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="cap-skel cap-skel--btn" />
                <div className="cap-skel cap-skel--btn" />
            </div>
        </div>
    )
}

function BookingCaptures() {
    const { id: bookingId } = useParams()
    const navigate = useNavigate()

    const [captures, setCaptures] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [sortOrder, setSortOrder] = useState('newest')
    const [objectFilter, setObjectFilter] = useState('')

    const load = async () => {
        setLoading(true)
        setError(null)
        try {
            const { data } = await api.get(`/api/captures?sessionId=${bookingId}`)
            setCaptures(data.items || [])
        } catch {
            setError('Failed to load captures. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [bookingId])

    const objectNames = [...new Set(captures.map(c => c.objectName).filter(Boolean))].sort()

    const sorted = [...captures].sort((a, b) => {
        const diff = new Date(b.timestamp) - new Date(a.timestamp)
        return sortOrder === 'newest' ? diff : -diff
    })

    const filtered = objectFilter
        ? sorted.filter(c => c.objectName === objectFilter)
        : sorted

    const filterMiss = !loading && !error && captures.length > 0 && filtered.length === 0

    return (
        <div className="cap-shell">
            <TopBar activePath="/bookings" />
            <div className="cap-body">
                <div className="cap-header">
                    <button className="bc-back-btn" onClick={() => navigate('/bookings')}>
                        ← Back to Bookings
                    </button>
                    <h1 className="cap-title">Session Captures</h1>
                    <p className="bc-booking-id">Booking #{bookingId}</p>
                </div>

                {!loading && !error && captures.length > 0 && (
                    <div className="cap-controls">
                        <select
                            className="cap-select"
                            value={objectFilter}
                            onChange={e => setObjectFilter(e.target.value)}
                        >
                            <option value="">All Objects</option>
                            {objectNames.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>

                        <div className="cap-sort-toggle">
                            <button
                                className={`cap-sort-btn${sortOrder === 'newest' ? ' cap-sort-btn--active' : ''}`}
                                onClick={() => setSortOrder('newest')}
                            >
                                Newest
                            </button>
                            <button
                                className={`cap-sort-btn${sortOrder === 'oldest' ? ' cap-sort-btn--active' : ''}`}
                                onClick={() => setSortOrder('oldest')}
                            >
                                Oldest
                            </button>
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="cap-list">
                        {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
                    </div>
                )}

                {!loading && error && (
                    <div className="cap-empty">
                        <div className="cap-empty-msg">{error}</div>
                        <button className="cap-btn cap-btn--primary" onClick={load}>Retry</button>
                    </div>
                )}

                {filterMiss && (
                    <div className="cap-empty">
                        <div className="cap-empty-msg">No captures match the current filter.</div>
                        <button className="cap-btn cap-btn--secondary" onClick={() => setObjectFilter('')}>
                            Clear Filter
                        </button>
                    </div>
                )}

                {!loading && !error && captures.length === 0 && (
                    <div className="cap-empty">
                        <div className="cap-empty-icon">📷</div>
                        <div className="cap-empty-msg">No captures for this session.</div>
                        <div className="cap-empty-sub">Images captured during the session will appear here.</div>
                    </div>
                )}

                {!loading && !error && filtered.length > 0 && (
                    <div className="cap-list">
                        {filtered.map(item => <CaptureCard key={item.id} item={item} />)}
                    </div>
                )}
            </div>
        </div>
    )
}

export default BookingCaptures
