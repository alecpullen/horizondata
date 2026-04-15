import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/useAuth'
import LoadingSkeleton from './LoadingSkeleton'

/**
 * ProtectedRoute - Wraps routes that require authentication
 *
 * Usage:
 * <Route path="/bookings" element={
 *   <ProtectedRoute>
 *     <MyBookings />
 *   </ProtectedRoute>
 * } />
 */
function ProtectedRoute({ children }) {
    const { isAuthenticated, isLoading } = useAuth()
    const location = useLocation()

    // Show loading while checking auth status
    if (isLoading) {
        return <LoadingSkeleton />
    }

    // Redirect to login if not authenticated, saving the intended URL
    if (!isAuthenticated) {
        // Save the current location so we can redirect back after login
        sessionStorage.setItem('authRedirectUrl', location.pathname + location.search)
        return <Navigate to="/login" replace />
    }

    // User is authenticated, render the protected content
    return children
}

export default ProtectedRoute
