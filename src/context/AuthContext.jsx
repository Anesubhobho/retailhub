
import {
  createContext,
  useContext,
  useEffect,
  useState
} from 'react'

import { supabase } from '../services/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(currentUser) {
    if (!currentUser) {
      setProfile(null)
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single()

    if (error || !data || !data.is_active) {
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      return
    }

    setProfile(data)
  }

  useEffect(() => {
    let mounted = true

    async function initialise() {
      const { data } = await supabase.auth.getSession()

      if (!mounted) return

      const currentUser = data.session?.user ?? null
      setUser(currentUser)

      await loadProfile(currentUser)

      if (mounted) setLoading(false)
    }

    initialise()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return

        const currentUser = session?.user ?? null
        setUser(currentUser)

        if (event === 'SIGNED_OUT') {
          setProfile(null)
          setLoading(false)
        } else {
          setLoading(true)

          // Avoid running Supabase queries inside the
          // authentication callback.
          setTimeout(() => {
            if (mounted) {
              loadProfile(currentUser)
                .finally(() => {
                  if (mounted) setLoading(false)
                })
            }
          }, 0)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) throw error

    setUser(data.user)
    await loadProfile(data.user)

    return data
  }

  async function logout() {
    const { error } = await supabase.auth.signOut()

    if (error) throw error

    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
