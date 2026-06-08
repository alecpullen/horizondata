import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSkeleton from './LoadingSkeleton'

/**
 * StudentRoute - guards routes that require an active student session.
 *
 * Without this, /live/student was directly reachable by anyone, so navigating
 * there bypassed the join flow entirely: the student was never registered with
 * the backend and the teacher's participant count stayed at 0. Here we require
 * a student session before rendering; otherwise we send them to /join.
 *
 * Usage:
 *   <Route path="/live/student" element={
 *     <StudentRoute><StudentView /></StudentRoute>
 *   } />
 */
function StudentRoute({ children }) {
    const { isLoading, isStudent, sessionId } = useAuth()

    if (isLoading) {
        return <LoadingSkeleton />
    }

    if (!isStudent || !sessionId) {
        return <Navigate to="/join" replace />
    }

    return children
}

export default StudentRoute
