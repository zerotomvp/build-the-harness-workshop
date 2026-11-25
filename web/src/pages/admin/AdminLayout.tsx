import { NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom'
import { useAuth } from '../../auth'
import type { Membership } from '../../types'

export interface AdminContext {
  groupId: number
  membership: Membership
}

export function useAdmin() {
  return useOutletContext<AdminContext>()
}

export default function AdminLayout() {
  const groupId = Number(useParams().groupId)
  const { membershipFor } = useAuth()
  const membership = membershipFor(groupId)

  if (!membership || membership.role === 'member') {
    return <p className="error">You need to be a group admin or treasurer to see this page.</p>
  }

  const isAdmin = membership.role === 'admin'
  const isTreasurer = membership.role === 'treasurer'

  return (
    <section>
      <div className="section-header">
        <h2>Manage {membership.groupName}</h2>
        <NavLink to={`/groups/${groupId}`} className="link">
          Back to group
        </NavLink>
      </div>
      <nav className="tabs">
        <NavLink to="." end>
          Members
        </NavLink>
        {isAdmin && <NavLink to="sessions">Sessions</NavLink>}
        {isTreasurer && <NavLink to="prices">Prices</NavLink>}
        {isTreasurer && <NavLink to="payments">Payments</NavLink>}
      </nav>
      <Outlet context={{ groupId, membership } satisfies AdminContext} />
    </section>
  )
}
