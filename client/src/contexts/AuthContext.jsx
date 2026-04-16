import { createContext, useState, useEffect, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const AuthContext = createContext({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    login: async () => {},
    logout: async () => {}
})

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    // Check for existing session on mount
    useEffect(() => {
        async function checkSession() {
            try {
                const response = await fetch(`${API_BASE}/api/auth/session`, {
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include'
                })

                if (response.ok) {
                    const data = await response.json()
                    if (data.authenticated && data.user) {
                        setUser(data.user)
                        setIsAuthenticated(true)
                    }
                }
            } catch (err) {
                console.error('Session check failed:', err)
            } finally {
                setIsLoading(false)
            }
        }

        checkSession()
    }, [])

    const login = useCallback(async (email, password) => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            })

            const data = await response.json()

            if (!response.ok) {
                return {
                    success: false,
                    error: data.error || 'Login failed'
                }
            }

            setUser(data.user)
            setIsAuthenticated(true)

            return {
                success: true,
                user: data.user
            }
        } catch (e) {
            console.error('Login error:', e)
            return {
                success: false,
                error: 'Network error. Please try again.'
            }
        }
    }, [])

    const logout = useCallback(async () => {
        try {
            await fetch(`${API_BASE}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            })
        } catch (e) {
            console.error('Logout error:', e)
        } finally {
            setUser(null)
            setIsAuthenticated(false)
        }
    }, [])

    const value = {
        user,
        isAuthenticated,
        isLoading,
        login,
        logout
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export { AuthContext }
