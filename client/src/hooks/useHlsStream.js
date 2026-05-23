import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

// Check HLS support once — result is stable across the session.
function detectHlsSupport() {
    if (Hls.isSupported()) return 'hlsjs'
    if (typeof document !== 'undefined') {
        const probe = document.createElement('video')
        if (probe.canPlayType('application/vnd.apple.mpegurl')) return 'native'
    }
    return 'none'
}

const HLS_SUPPORT = detectHlsSupport()

export function useHlsStream(hlsUrl, videoRef) {
    const hlsRef = useRef(null)
    const [status, setStatus] = useState('idle') // idle | connected | failed

    useEffect(() => {
        if (!hlsUrl || !videoRef.current || HLS_SUPPORT === 'none') return

        const video = videoRef.current

        if (HLS_SUPPORT === 'hlsjs') {
            const hls = new Hls({ lowLatencyMode: true })
            hlsRef.current = hls
            hls.loadSource(hlsUrl)
            hls.attachMedia(video)

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                setStatus('connected')
                video.play().catch(() => {})
            })

            hls.on(Hls.Events.ERROR, (_event, data) => {
                if (data.fatal) setStatus('failed')
            })

            return () => {
                hls.destroy()
                hlsRef.current = null
            }
        }

        // Native HLS (Safari)
        video.src = hlsUrl
        const onLoaded = () => {
            setStatus('connected')
            video.play().catch(() => {})
        }
        const onError = () => setStatus('failed')
        video.addEventListener('loadedmetadata', onLoaded)
        video.addEventListener('error', onError)
        return () => {
            video.removeEventListener('loadedmetadata', onLoaded)
            video.removeEventListener('error', onError)
            video.src = ''
        }
    }, [hlsUrl, videoRef])

    // If HLS is not supported at all, surface failure immediately via derived state.
    const effectiveStatus = HLS_SUPPORT === 'none' && hlsUrl ? 'failed' : status

    return { status: effectiveStatus }
}
