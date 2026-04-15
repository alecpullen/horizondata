import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ToastProvider from './components/ui/ToastProvider'
import SessionTimeoutModal from './components/auth/SessionTimeoutModal'
import Landing      from './pages/Landing'
import Login        from './pages/Login'
import Register     from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail  from './pages/VerifyEmail'
import PendingApproval from './pages/PendingApproval'
import MyBookings   from './pages/MyBookings'
import MyAccount    from './pages/MyAccount'
import TeacherView  from './pages/TeacherView'
import StudentView  from './pages/StudentView'
import StudentJoin  from './pages/StudentJoin'
import SessionLobby from './pages/SessionLobby'
import NewBooking from './pages/NewBooking'
import { useMockSession } from './hooks/useLocalStorage'
import { useSessionTimeout } from './hooks/useSessionTimeout'
import { useToast } from './components/ui/ToastProvider'

// Component to handle session timeout for authenticated users
function SessionTimeoutWrapper({ children }) {
    const { isAuthenticated, logout, extendSession } = useMockSession()
    const { showToast } = useToast()

    const { showWarning, timeLeft, extendSession: handleExtend, logout: handleLogout } = useSessionTimeout({
        isAuthenticated,
        onExtend: () => {
            extendSession()
            showToast({ type: 'success', message: 'Session extended!' })
        },
        onLogout: () => {
            logout()
            showToast({ type: 'info', message: 'Session expired. Please sign in again.' })
            window.location.href = '/login'
        },
        warningTime: 120, // 2 minutes warning
        sessionDuration: 60 * 60 // 1 hour for demo (set to 7 * 60 for 7 minutes)
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

function App() {
    return (
        <ToastProvider>
            <BrowserRouter>
                <SessionTimeoutWrapper>
                    <Routes>
                        <Route path="/"                 element={<Landing />}           />
                        <Route path="/login"           element={<Login />}             />
                        <Route path="/register"        element={<Register />}          />
                        <Route path="/forgot-password" element={<ForgotPassword />}    />
                        <Route path="/reset-password"  element={<ResetPassword />}     />
                        <Route path="/verify-email"    element={<VerifyEmail />}       />
                        <Route path="/pending-approval" element={<PendingApproval />} />
                        <Route path="/bookings"        element={<MyBookings />}        />
                        <Route path="/bookings/new"  element={<NewBooking />}        />
                        <Route path="/account"         element={<MyAccount />}         />
                        <Route path="/live/teacher"    element={<TeacherView />}       />
                        <Route path="/live/student"    element={<StudentView />}       />
                        <Route path="/join"            element={<StudentJoin />}       />
                        <Route path="/lobby"           element={<SessionLobby />}      />
                    </Routes>
                </SessionTimeoutWrapper>
            </BrowserRouter>
        </ToastProvider>
    )
}

export default App
