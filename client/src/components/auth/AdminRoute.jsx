import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSkeleton from './LoadingSkeleton'

function AdminRoute({ children }) {
    const { isAuthenticated, isLoading, user } = useAuth()
    const location = useLocation()

    console.log('[AdminRoute] render state:', {
        isAuthenticated,
        isLoading,
        userRole: user?.role,
        path: location.pathname
    })

    if (isLoading) return <LoadingSkeleton />

    if (!isAuthenticated) {
        console.log('[AdminRoute] Redirecting to /login - not authenticated')
        sessionStorage.setItem('redirectAfterAuth', location.pathname + location.search)
        return <Navigate to="/login" replace />
    }

    if (user?.role !== 'admin') {
        console.log('[AdminRoute] Redirecting to / - not admin. Role:', user?.role)
        return <Navigate to="/" replace />
    }

    return children
}

export default AdminRoute
