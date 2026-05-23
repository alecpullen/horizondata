import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ToastProvider from './components/ui/ToastProvider'
import SessionTimeoutModal from './components/auth/SessionTimeoutModal'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Landing      from './pages/Landing'
import TeacherLogin from './pages/TeacherLogin'
import TeacherSignup from './pages/TeacherSignup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail  from './pages/VerifyEmail'
import PendingApproval from './pages/PendingApproval'
import MyBookings   from './pages/MyBookings'
import MyAccount    from './pages/MyAccount'
import TeacherView  from './pages/TeacherView'
import StudentView  from './pages/StudentView'
import PublicView   from './pages/PublicView'
import StudentJoin  from './pages/StudentJoin'
import StudentLobby from './pages/StudentLobby'
import SessionLobby from './pages/SessionLobby'
import NewBooking from './pages/NewBooking'
import Captures from './pages/Captures'
import BookingCaptures from './pages/BookingCaptures'
import Scheduling from './pages/Scheduling'
import AdminRoute    from './components/auth/AdminRoute'
import AdminShell    from './pages/admin/AdminShell'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminTeachers  from './pages/admin/AdminTeachers'
import AdminBookings  from './pages/admin/AdminBookings'
import AdminSessions  from './pages/admin/AdminSessions'
import AdminSafety    from './pages/admin/AdminSafety'
import AdminQueue     from './pages/admin/AdminQueue'
import AdminSettings  from './pages/admin/AdminSettings'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/AuthContext'
import { useSessionTimeout } from './hooks/useSessionTimeout'
import { useToast } from './components/ui/ToastProvider'

// Component to handle session timeout for authenticated users
function SessionTimeoutWrapper({ children }) {
    const { isAuthenticated, logoutTeacher, refreshToken } = useAuth()
    const { showToast } = useToast()

    const { showWarning, timeLeft, extendSession: handleExtend, logout: handleLogout } = useSessionTimeout({
        isAuthenticated,
        onExtend: async () => {
            const result = await refreshToken()
            if (result) {
                showToast({ type: 'success', message: 'Session extended!' })
            } else {
                logoutTeacher()
                showToast({ type: 'error', message: 'Could not extend session. Please sign in again.' })
                window.location.href = '/login'
            }
        },
        onLogout: () => {
            logoutTeacher()
            showToast({ type: 'info', message: 'Session expired. Please sign in again.' })
            window.location.href = '/login'
        },
        warningTime: 120, // 2 minutes warning
        sessionDuration: 60 * 60 // 1 hour for demo
    })

    return (
        <>
            {children}
            <SessionTimeoutModal
                isOpen={showWarning}
                timeLeft={timeLeft}
                onExtend={handleExtend}
                onLogout={handleLogout}
            />
        </>
    )
}

function AppRoutes() {
    return (
        <SessionTimeoutWrapper>
            <Routes>
                {/* Public routes */}
                <Route path="/"                 element={<Landing />}           />
                <Route path="/login"           element={<TeacherLogin />}      />
                <Route path="/signup"          element={<TeacherSignup />}     />
                <Route path="/forgot-password" element={<ForgotPassword />}    />
                <Route path="/reset-password"  element={<ResetPassword />}     />
                <Route path="/verify-email"    element={<VerifyEmail />}       />
                <Route path="/pending-approval" element={<PendingApproval />} />
                <Route path="/join"            element={<StudentJoin />}       />
                <Route path="/student/lobby/:bookingId" element={<StudentLobby />} />

                {/* Protected routes - require authentication */}
                <Route path="/bookings" element={
                    <ProtectedRoute><MyBookings /></ProtectedRoute>
                } />
                <Route path="/bookings/new" element={
                    <ProtectedRoute><NewBooking /></ProtectedRoute>
                } />
                <Route path="/scheduling" element={
                    <ProtectedRoute><Scheduling /></ProtectedRoute>
                } />
                <Route path="/account" element={
                    <ProtectedRoute><MyAccount /></ProtectedRoute>
                } />
                <Route path="/live/teacher" element={
                    <ProtectedRoute><TeacherView /></ProtectedRoute>
                } />
                {/* Students are anonymous — no auth required */}
                <Route path="/live/student" element={<StudentView />} />
                {/* Public telescope viewfinder — no auth required */}
                <Route path="/live/public"  element={<PublicView />} />
                <Route path="/lobby/:bookingId?" element={
                    <ProtectedRoute><SessionLobby /></ProtectedRoute>
                } />
                <Route path="/captures" element={
                    <ProtectedRoute><Captures /></ProtectedRoute>
                } />
                <Route path="/bookings/:id/captures" element={
                    <ProtectedRoute><BookingCaptures /></ProtectedRoute>
                } />

                {/* Admin routes - require role=admin */}
                <Route path="/admin" element={<AdminRoute><AdminShell /></AdminRoute>}>
                    <Route index            element={<AdminDashboard />} />
                    <Route path="teachers"  element={<AdminTeachers />} />
                    <Route path="bookings"  element={<AdminBookings />} />
                    <Route path="sessions"  element={<AdminSessions />} />
                    <Route path="safety"    element={<AdminSafety />} />
                    <Route path="queue"     element={<AdminQueue />} />
                    <Route path="settings"  element={<AdminSettings />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </SessionTimeoutWrapper>
    )
}

function App() {
    return (
        <ToastProvider>
            <AuthProvider>
                <BrowserRouter>
                    <AppRoutes />
                </BrowserRouter>
            </AuthProvider>
        </ToastProvider>
    )
}

export default App
