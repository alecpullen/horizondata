import { useState, useEffect } from 'react'
import api from '../lib/api'
import { downloadFile } from '../utils/captures'
import './CaptureCard.css'

function CaptureThumb({ captureId, objectName }) {
    const [src, setSrc] = useState(null)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        let cancelled = false
        let blobUrl = null
        api.get(`/api/captures/${captureId}/download`, { responseType: 'blob' })
            .then(res => {
                if (cancelled) return
                blobUrl = URL.createObjectURL(res.data)
                setSrc(blobUrl)
            })
            .catch(() => { if (!cancelled) setFailed(true) })
        return () => {
            cancelled = true
            if (blobUrl) URL.revokeObjectURL(blobUrl)
        }
    }, [captureId])

    if (failed) {
        return (
            <div className="cap-thumb-wrap cap-thumb--placeholder cap-thumb--failed">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                </svg>
            </div>
        )
    }

    if (!src) {
        return <div className="cap-thumb-wrap cap-thumb--placeholder" />
    }

    return (
        <div className="cap-thumb-wrap">
            <img src={src} alt={objectName} className="cap-thumb" />
        </div>
    )
}

export function CaptureCard({ item }) {
    const ts = new Date(item.timestamp)
    const dateStr = ts.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    const timeStr = ts.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    const coords = item.coordinates
    const hasCoords = coords && (coords.ra != null || coords.alt != null)

    return (
        <div className="cap-card">
            <CaptureThumb captureId={item.id} objectName={item.objectName} />

            <div className="cap-main">
                <div className="cap-object">{item.objectName || 'Unknown'}</div>
                <div className="cap-date">{dateStr} · {timeStr}</div>
                <div className="cap-meta">
                    Captured by: {item.capturedByName || (item.capturedBy === 'teacher' ? 'Teacher' : 'Student')}
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

            <div className="cap-actions">
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

export default CaptureCard
