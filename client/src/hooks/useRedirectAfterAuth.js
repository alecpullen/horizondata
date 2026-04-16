import { useNavigate, useLocation } from 'react-router-dom'
import { useCallback, useEffect } from 'react'

/**
 * Hook to save the current URL before redirecting to login,
 * and redirect back to that URL after successful authentication.
 */
export function useRedirectAfterAuth() {
    const navigate = useNavigate()
    const location = useLocation()

    /**
     * Save the current URL to sessionStorage (if not already on login page)
     */
    const saveRedirectUrl = useCallback(() => {
        const currentPath = location.pathname + location.search
        const authPages = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email']

        // Don't save if already on an auth page
        if (!authPages.some(page => currentPath.startsWith(page))) {
            sessionStorage.setItem('redirectAfterAuth', currentPath)
            console.log('[useRedirectAfterAuth] Saved redirect URL:', currentPath)
        }
    }, [location])

    /**
     * Get the saved redirect URL and clear it from storage
     */
    const getRedirectUrl = useCallback(() => {
        const saved = sessionStorage.getItem('redirectAfterAuth')
        sessionStorage.removeItem('redirectAfterAuth')
        console.log('[useRedirectAfterAuth] Retrieved redirect URL:', saved)
        return saved || '/bookings' // Default fallback
    }, [])

    /**
     * Redirect to the saved URL (or default)
     */
    const redirect = useCallback(() => {
        const targetUrl = getRedirectUrl()
        console.log('[useRedirectAfterAuth] Redirecting to:', targetUrl)
        navigate(targetUrl)
    }, [getRedirectUrl, navigate])

    /**
     * Redirect to a specific URL and clear any saved redirect
     */
    const redirectTo = useCallback((url) => {
        sessionStorage.removeItem('redirectAfterAuth')
        navigate(url)
    }, [navigate])

    // Automatically save redirect URL when navigating to login
    useEffect(() => {
        // If we're on the login page, check if there's a "from" query param
        const searchParams = new URLSearchParams(location.search)
        const from = searchParams.get('from')

        if (from) {
            sessionStorage.setItem('redirectAfterAuth', from)
            console.log('[useRedirectAfterAuth] Saved redirect from query param:', from)
        }
    }, [location])

    return {
        saveRedirectUrl,
        getRedirectUrl,
        redirect,
        redirectTo
    }
}

/**
 * Hook to check if user needs to be redirected to login
 * Call this on protected pages to enforce auth
 */
export function useRequireAuth({ isAuthenticated }) {
    const { saveRedirectUrl } = useRedirectAfterAuth()
    const navigate = useNavigate()

    useEffect(() => {
        if (!isAuthenticated) {
            console.log('[useRequireAuth] User not authenticated, redirecting to login')
            saveRedirectUrl()
            navigate('/login')
        }
    }, [isAuthenticated, saveRedirectUrl, navigate])
}

/**
 * Helper to construct login URL with redirect parameter
 */
export function getLoginUrlWithRedirect(currentPath) {
    const encodedPath = encodeURIComponent(currentPath)
    return `/login?from=${encodedPath}`
}
