import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing      from './pages/Landing'
import Login        from './pages/Login'
import MyBookings   from './pages/MyBookings'
import TeacherView  from './pages/TeacherView'
import StudentView  from './pages/StudentView'
import StudentJoin  from './pages/StudentJoin'
import SessionLobby from './pages/SessionLobby'

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/"              element={<Landing />}         />
                <Route path="/login"         element={<Login />}          />
                <Route path="/bookings"      element={<MyBookings />}   />
                <Route path="/live/teacher"  element={<TeacherView />}  />
                <Route path="/live/student"  element={<StudentView />}  />
                <Route path="/join"          element={<StudentJoin />}  />
                <Route path="/lobby"         element={<SessionLobby />} />
            </Routes>
        </BrowserRouter>
    )
}

export default App