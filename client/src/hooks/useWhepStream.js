import { useEffect, useRef, useCallback, useState } from 'react'

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]
const ICE_GATHER_TIMEOUT_MS = 8000

export function useWhepStream(whepUrl, videoRef) {
    const pcRef = useRef(null)
    const [status, setStatus] = useState('idle') // idle | connecting | connected | failed

    const cleanup = useCallback(() => {
        if (pcRef.current) {
            pcRef.current.close()
            pcRef.current = null
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null
        }
    }, [videoRef])

    const connect = useCallback(async () => {
        if (!whepUrl || !videoRef.current) return

        cleanup()
        setStatus('connecting')

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
        pcRef.current = pc

        pc.addTransceiver('video', { direction: 'recvonly' })
        pc.addTransceiver('audio', { direction: 'recvonly' })

        pc.ontrack = (event) => {
            if (videoRef.current && event.streams[0]) {
                videoRef.current.srcObject = event.streams[0]
            }
        }

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') setStatus('connected')
            if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
                setStatus('failed')
            }
        }

        try {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)

            await new Promise((resolve, reject) => {
                if (pc.iceGatheringState === 'complete') {
                    resolve()
                    return
                }
                const timeout = setTimeout(
                    () => reject(new Error('ICE gathering timed out')),
                    ICE_GATHER_TIMEOUT_MS
                )
                pc.onicegatheringstatechange = () => {
                    if (pc.iceGatheringState === 'complete') {
                        clearTimeout(timeout)
                        resolve()
                    }
                }
            })

            const response = await fetch(whepUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/sdp' },
                body: pc.localDescription.sdp,
            })

            if (!response.ok) throw new Error(`WHEP ${response.status}`)

            const sdpAnswer = await response.text()
            await pc.setRemoteDescription({ type: 'answer', sdp: sdpAnswer })
        } catch {
            cleanup()
            setStatus('failed')
        }
    }, [whepUrl, videoRef, cleanup])

    useEffect(() => {
        connect()
        return cleanup
    }, [connect, cleanup])

    return { status, reconnect: connect }
}
