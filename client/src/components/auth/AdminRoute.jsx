import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSkeleton from './LoadingSkeleton'

function AdminRoute({ children }) {
    const { isAuthenticated, isLoading, user } = useAuth()
    const location = useLocation()

    if (isLoading) return <LoadingSkeleton />

    if (!isAuthenticated) {
        sessionStorage.setItem('authRedirectUrl', location.pathname + location.search)
        return <Navigate to="/login" replace />
    }

    if (user?.role !== 'admin') return <Navigate to="/" replace />

    return children
}

export default AdminRoute
