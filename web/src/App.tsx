import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import AdminLayout from './pages/admin/AdminLayout'
import MembersAdmin from './pages/admin/MembersAdmin'
import PaymentsAdmin from './pages/admin/PaymentsAdmin'
import PricesAdmin from './pages/admin/PricesAdmin'
import SessionsAdmin from './pages/admin/SessionsAdmin'
import ChatPage from './pages/ChatPage'
import FeesPage from './pages/FeesPage'
import GroupPage from './pages/GroupPage'
import GroupsPage from './pages/GroupsPage'
import InvitePage from './pages/InvitePage'
import LoginPage from './pages/LoginPage'

export default function App() {
  const { me, loading, logout } = useAuth()

  if (loading) return <div className="centered">Loading…</div>
  if (!me) return <LoginPage />

  return (
    <div className="app">
      <header className="topbar">
        <span className="logo">Hive</span>
        <nav>
          <NavLink to="/" end>
            Groups
          </NavLink>
          <NavLink to="/chat">Chat</NavLink>
          <NavLink to="/fees">My fees</NavLink>
        </nav>
        <div className="user">
          <span className="avatar" style={{ background: me.user.avatarColor }}>
            {me.user.name[0]}
          </span>
          {me.user.name}
          <button className="link" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<GroupsPage />} />
          <Route path="/groups/:groupId" element={<GroupPage />} />
          <Route path="/groups/:groupId/admin" element={<AdminLayout />}>
            <Route index element={<MembersAdmin />} />
            <Route path="sessions" element={<SessionsAdmin />} />
            <Route path="prices" element={<PricesAdmin />} />
            <Route path="payments" element={<PaymentsAdmin />} />
          </Route>
          <Route path="/invite/:groupId" element={<InvitePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/fees" element={<FeesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
