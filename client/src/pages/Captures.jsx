import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import CaptureCard from '../components/CaptureCard'
import api from '../lib/api'
import './Captures.css'

import api from '../lib/api'
import './Captures.css'

async function downloadFile(url, fallbackName) {
    const res = await api.get(url, { responseType: 'blob' })
    const href = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = href
    a.download = fallbackName
    a.click()
    URL.revokeObjectURL(href)
}

function CaptureCard({ item }) {
    const ts = new Date(item.timestamp)
    const dateStr = ts.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    const timeStr = ts.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    const coords = item.coordinates
    const hasCoords = coords && (coords.ra != null || coords.alt != null)

    return (
        <div className="cap-card">
            <div className="cap-card-main">
                <div className="cap-object">{item.objectName || 'Unknown'}</div>
                <div className="cap-date">{dateStr} · {timeStr}</div>
                <div className="cap-meta">
                    Captured by: {item.capturedBy === 'teacher' ? 'Teacher' : 'Student'}
                </div>
                {hasCoords && (
                    <div className="cap-coords">
                        {coords.ra != null && <span>RA {coords.ra.toFixed(1)}°</span>}
                        {coords.dec != null && <span>Dec {coords.dec.toFixed(1)}°</span>}
                        {coords.alt != null && <span>Alt {coords.alt.toFixed(1)}°</span>}
                        {coords.az != null && <span>Az {coords.az.toFixed(1)}°</span>}
                    </div>
                )}
            </div>
            <div className="cap-card-actions">
                <button
                    className="cap-btn cap-btn--primary"
                    onClick={() => downloadFile(
                        `/api/captures/${item.id}/download`,
                        `${item.objectName || 'capture'}_${item.id}.png`
                    )}
                >
                    Download Image
                </button>
                <button
                    className="cap-btn cap-btn--secondary"
                    onClick={() => downloadFile(
                        `/api/captures/${item.id}/metadata`,
                        `${item.objectName || 'capture'}_${item.id}.json`
                    )}
                >
                    Download Metadata
                </button>
            </div>
        </div>
    )
}

function SkeletonCard() {
    return (
        <div className="cap-card cap-card--skeleton">
            <div className="cap-card-main">
                <div className="cap-skel cap-skel--title" />
                <div className="cap-skel cap-skel--sub" />
                <div className="cap-skel cap-skel--sub cap-skel--short" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="cap-card-actions">
                <div className="cap-skel cap-skel--btn" />
                <div className="cap-skel cap-skel--btn" />
            </div>
        </div>
    )
}

function Captures() {
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
            const { data } = await api.get('/api/captures')
            setCaptures(data.items || [])
        } catch {
            setError('Failed to load captures. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

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
            <TopBar activePath="/captures" />
            <div className="cap-body">
                <div className="cap-header">
                    <h1 className="cap-title">Captures</h1>
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
                        <div className="cap-empty-msg">No captures yet.</div>
                        <div className="cap-empty-sub">Captures taken during telescope sessions will appear here.</div>
                        <button className="cap-btn cap-btn--secondary" onClick={() => navigate('/bookings')}>
                            Go to Bookings
                        </button>
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

export default Captures
