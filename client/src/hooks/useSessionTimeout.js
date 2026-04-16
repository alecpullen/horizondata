import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Hook to manage session timeout warnings and auto-logout
 * Simulates session management for UI testing without BetterAuth
 */
export function useSessionTimeout({
    isAuthenticated,
    onExtend,
    onLogout,
    warningTime = 120, // 2 minutes before expiry
    sessionDuration = 7 * 60 // 7 minutes total session (short for demo)
}) {
    const [showWarning, setShowWarning] = useState(false)
    const [timeLeft, setTimeLeft] = useState(warningTime)

    // Use refs to track timers without causing re-renders
    const warningTimerRef = useRef(null)
    const expiryTimerRef = useRef(null)
    const countdownIntervalRef = useRef(null)

    // Clear all timers
    const clearAllTimers = useCallback(() => {
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
        if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current)
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }, [])

    // Start session timers
    const startSession = useCallback(() => {
        clearAllTimers()
        setShowWarning(false)
        setTimeLeft(warningTime)

        // Set timer to show warning
        const warningDelay = (sessionDuration - warningTime) * 1000
        warningTimerRef.current = setTimeout(() => {
            setShowWarning(true)

            // Start countdown
            countdownIntervalRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(countdownIntervalRef.current)
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
        }, warningDelay)

        // Set timer to auto-logout
        expiryTimerRef.current = setTimeout(() => {
            clearAllTimers()
            onLogout()
        }, sessionDuration * 1000)

    }, [clearAllTimers, onLogout, sessionDuration, warningTime])

    // Extend session when user clicks "Stay logged in"
    const extendSession = useCallback(() => {
        clearAllTimers()
        setShowWarning(false)
        setTimeLeft(warningTime)

        // Call the extend callback (to update session timestamp)
        onExtend()

        // Restart timers
        startSession()

        console.log('[useSessionTimeout] Session extended')
    }, [clearAllTimers, onExtend, startSession, warningTime])

    // Handle logout from modal
    const handleLogout = useCallback(() => {
        clearAllTimers()
        setShowWarning(false)
        onLogout()
    }, [clearAllTimers, onLogout])

    // Start/stop session timers based on auth state
    useEffect(() => {
        if (isAuthenticated) {
            startSession()
        } else {
            clearAllTimers()
            setShowWarning(false)
        }

        return clearAllTimers
    }, [isAuthenticated, startSession, clearAllTimers])

    return {
        showWarning,
        timeLeft,
        extendSession,
        logout: handleLogout
    }
}

/**
 * Hook specifically for the modal countdown display
 */
export function useCountdown(initialSeconds) {
    const [seconds, setSeconds] = useState(initialSeconds)
    const [isRunning, setIsRunning] = useState(false)

    const start = useCallback(() => {
        setIsRunning(true)
    }, [])

    const stop = useCallback(() => {
        setIsRunning(false)
    }, [])

    const reset = useCallback((newSeconds) => {
        setSeconds(newSeconds ?? initialSeconds)
        setIsRunning(false)
    }, [initialSeconds])

    useEffect(() => {
        if (!isRunning || seconds <= 0) return

        const timer = setInterval(() => {
            setSeconds(prev => {
                if (prev <= 1) {
                    clearInterval(timer)
                    setIsRunning(false)
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [isRunning, seconds])

    const formatted = {
        minutes: Math.floor(seconds / 60),
        seconds: seconds % 60,
        display: `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`
    }

    return {
        seconds,
        formatted,
        isRunning,
        start,
        stop,
        reset
    }
}
