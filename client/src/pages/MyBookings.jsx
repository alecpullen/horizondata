import TopBar from '../components/TopBar'

function MyBookings() {
    return (
        <div className="page-shell">
            <TopBar activePath="/bookings" />
            <main style={{ padding: '40px', color: 'var(--teal)' }}>
                My Bookings page — building next
            </main>
        </div>
    )
}

export default MyBookings