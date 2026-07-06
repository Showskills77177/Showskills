import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useUserAuth } from '../auth/UserAuthProvider'

/** /login and /register open the auth modal on the home page. */
export default function AuthModalRedirect({ view = 'login' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { status, openAuthModal } = useUserAuth()

  useEffect(() => {
    if (status === 'loading') return
    openAuthModal(view)
    navigate('/', { replace: true, state: location.state })
  }, [status, view, openAuthModal, navigate, location.state])

  return null
}
