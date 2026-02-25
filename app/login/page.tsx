'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (authError) {
      setError(authError.message)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 text-white text-2xl font-black mb-4">
            J
          </div>
          <h1 className="text-3xl font-extrabold text-white">Jeni Life OS</h1>
          <p className="text-gray-500 mt-2 text-sm">Your personal AI life intelligence</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8">
          <form onSubmit={handleLogin}>
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1.5 tracking-wider uppercase">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact.bastesomnath@gmail.com"
                required
                className="w-full py-3 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>

            <div className="mb-6">
              <label className="block text-xs text-gray-500 mb-1.5 tracking-wider uppercase">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full py-3 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Built by Somnath · Powered by Supabase + Groq AI
        </p>
      </div>
    </div>
  )
}
