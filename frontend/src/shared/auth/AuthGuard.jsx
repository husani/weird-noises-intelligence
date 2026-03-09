/**
 * Authentication guard and context provider.
 *
 * On mount, calls /api/auth/me to check if the user is authenticated.
 * - If authenticated: renders children with user data in AuthContext.
 * - If not (401): redirects to /api/auth/login (the OAuth flow).
 *
 * Usage:
 *   import { useAuth } from './shared/auth/AuthGuard'
 *   const user = useAuth()  // { email, name, picture }
 */

import React, { createContext, useContext, useEffect, useState } from 'react'

const AuthContext = createContext(null)

/** Hook to access the authenticated user. Returns { email, name, picture }. */
export function useAuth() {
  return useContext(AuthContext)
}

export default function AuthGuard({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (res.status === 401) {
          window.location.href = `/api/auth/login?redirect=${window.location.pathname}`
          return null
        }
        return res.json()
      })
      .then(data => {
        if (data) setUser(data)
        setLoading(false)
      })
      .catch(() => {
        window.location.href = '/api/auth/login'
      })
  }, [])

  if (loading) {
    return (
      <div className="login-page">
        <div className="loading-spinner" />
      </div>
    )
  }

  return (
    <AuthContext.Provider value={user}>
      {children}
    </AuthContext.Provider>
  )
}
