import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
import StudentJoin  from './pages/StudentJoin'
import StudentLobby from './pages/StudentLobby'
import SessionLobby from './pages/SessionLobby'
import NewBooking from './pages/NewBooking'
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
                <Route path="/account" element={
                    <ProtectedRoute><MyAccount /></ProtectedRoute>
                } />
                <Route path="/live/teacher" element={
                    <ProtectedRoute><TeacherView /></ProtectedRoute>
                } />
                {/* Students are anonymous — no auth required */}
                <Route path="/live/student" element={<StudentView />} />
                <Route path="/lobby/:bookingId?" element={
                    <ProtectedRoute><SessionLobby /></ProtectedRoute>
                } />
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
