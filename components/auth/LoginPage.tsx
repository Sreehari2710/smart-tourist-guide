
// components/auth/LoginPage.tsx
"use client"

import type React from "react"
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { FiMail, FiLock, FiEye, FiEyeOff, FiLogIn, FiMapPin } from "react-icons/fi"
import RegisterPage from "./RegisterPage"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [email, setEmail] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [message, setMessage] = useState<string>("")
  const [showRegister, setShowRegister] = useState<boolean>(false)
  const [showPassword, setShowPassword] = useState<boolean>(false)

  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setMessage(`Error: ${error.message}`)
      } else {
        setMessage("Login successful! Redirecting...")
        router.push("/dashboard")
      }
    } catch (error: any) {
      setMessage(`An unexpected error occurred: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setMessage("Please enter your email address to reset your password.")
      return
    }

    setLoading(true)
    setMessage("")

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      })

      if (error) {
        setMessage(`Error sending reset email: ${error.message}`)
      } else {
        setMessage("Password reset email sent! Check your inbox.")
      }
    } catch (error: any) {
      setMessage(`An unexpected error occurred: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (showRegister) {
    return <RegisterPage onBackToLogin={() => setShowRegister(false)} />
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row items-center justify-center relative overflow-hidden bg-gradient-to-br from-sky-50 via-blue-50 to-emerald-50 p-4 sm:p-6">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-10 left-10 w-24 h-24 bg-sky-300 rounded-full blur-2xl"></div>
        <div className="absolute top-40 right-20 w-40 h-40 bg-emerald-300 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-1/4 w-32 h-32 bg-amber-300 rounded-full blur-3xl"></div>
        <div className="absolute bottom-40 right-10 w-28 h-28 bg-sky-400 rounded-full blur-3xl"></div>
      </div>

      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: "url('/smart-city-guide login.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-sky-100/30 to-emerald-100/30"></div>
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl w-full max-w-5xl z-10 border border-white/20 overflow-hidden">
        <div className="flex flex-col md:flex-row min-h-[500px]">
          <div className="md:flex-1 bg-gradient-to-br from-sky-500 to-emerald-500 p-6 sm:p-8 flex flex-col justify-center items-center text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 left-4 w-16 h-16 bg-white rounded-full blur-2xl"></div>
              <div className="absolute bottom-8 right-8 w-28 h-28 bg-white rounded-full blur-3xl"></div>
              <div className="absolute top-1/2 left-1/2 w-14 h-14 bg-white rounded-full blur-xl"></div>
            </div>

            <div className="relative z-10 text-center">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <FiMapPin className="text-white text-2xl" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Welcome Back!</h2>
              <p className="text-sky-100 text-sm mb-4 px-4 sm:px-8">
                Continue your journey and discover new adventures with our smart travel guide
              </p>
              <div className="flex items-center justify-center space-x-6 text-sky-100 text-sm">
                <div className="text-center">
                  <div className="text-xl font-bold">24/7</div>
                  <div>Support</div>
                </div>
                <div className="w-px h-10 bg-sky-200/30"></div>
                <div className="text-center">
                  <div className="text-xl font-bold">Smart</div>
                  <div>Suggestions</div>
                </div>
              </div>
            </div>
          </div>

          <div className="md:flex-1 p-6 sm:p-8 flex flex-col justify-center">
            <div className="max-w-sm mx-auto w-full">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Sign In</h3>
                <p className="text-slate-600 text-sm">Welcome back to your travel companion</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="relative group">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="email"
                      placeholder="Enter your email"
                      className="pl-10 pr-4 py-3 w-full border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-slate-700 bg-white/70 backdrop-blur-sm hover:bg-white/90 text-sm"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="relative group">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      className="pl-10 pr-10 py-3 w-full border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-slate-700 bg-white/70 backdrop-blur-sm hover:bg-white/90 text-sm"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-sky-600 hover:text-sky-700 font-medium text-xs hover:underline"
                    disabled={loading}
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-semibold py-3 rounded-lg shadow-lg transition-all flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <FiLogIn className="w-4 h-4" />
                      <span>Sign In</span>
                    </>
                  )}
                </button>
              </form>

              {message && (
                <div
                  className={`mt-4 p-3 rounded-lg text-center text-xs font-medium ${
                    message.includes("Error")
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  {message}
                </div>
              )}

              <div className="mt-6 text-center">
                <p className="text-slate-600 text-xs mb-2">Don't have an account?</p>
                <button
                  onClick={() => setShowRegister(true)}
                  className="text-sky-600 hover:text-sky-700 font-semibold hover:underline text-sm"
                >
                  Create Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-20 left-20 w-2 h-2 bg-sky-400 rounded-full opacity-60 animate-pulse"></div>
      <div className="absolute top-32 right-32 w-1.5 h-1.5 bg-emerald-400 rounded-full opacity-60 animate-pulse delay-1000"></div>
      <div className="absolute bottom-24 left-32 w-3 h-3 bg-amber-400 rounded-full opacity-60 animate-pulse delay-500"></div>
      <div className="absolute bottom-40 right-24 w-1.5 h-1.5 bg-sky-500 rounded-full opacity-60 animate-pulse delay-700"></div>
    </div>
  )
}
