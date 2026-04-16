import { useState, useEffect, useCallback } from 'react'

export function useLocalStorage(key, initialValue) {
    // Get initial value from localStorage or use initialValue
    const [value, setValue] = useState(() => {
        try {
            const saved = localStorage.getItem(key)
            return saved ? JSON.parse(saved) : initialValue
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error)
            return initialValue
        }
    })

    // Update localStorage when value changes
    useEffect(() => {
        try {
            if (value === null || value === undefined) {
                localStorage.removeItem(key)
            } else {
                localStorage.setItem(key, JSON.stringify(value))
            }
        } catch (error) {
            console.warn(`Error setting localStorage key "${key}":`, error)
        }
    }, [key, value])

    // Remove item from localStorage
    const removeValue = useCallback(() => {
        setValue(null)
        localStorage.removeItem(key)
    }, [key])

    return [value, setValue, removeValue]
}

// Specialized hook for mock session (simulating auth persistence)
export function useMockSession() {
    const [session, setSession, removeSession] = useLocalStorage('mockSession', null)

    const isAuthenticated = !!session

    const login = useCallback((email, rememberMe = false) => {
        const newSession = {
            email,
            timestamp: Date.now(),
            expiresAt: rememberMe
                ? Date.now() + 7 * 24 * 60 * 60 * 1000  // 7 days
                : Date.now() + 24 * 60 * 60 * 1000       // 24 hours
        }
        setSession(newSession)
        return newSession
    }, [setSession])

    const logout = useCallback(() => {
        removeSession()
    }, [removeSession])

    const extendSession = useCallback(() => {
        if (session) {
            setSession({
                ...session,
                expiresAt: Date.now() + 24 * 60 * 60 * 1000
            })
        }
    }, [session, setSession])

    const checkSession = useCallback(() => {
        if (!session) return false

        // Check if session has expired
        if (Date.now() > session.expiresAt) {
            removeSession()
            return false
        }

        return true
    }, [session, removeSession])

    return {
        session,
        isAuthenticated,
        login,
        logout,
        extendSession,
        checkSession
    }
}
