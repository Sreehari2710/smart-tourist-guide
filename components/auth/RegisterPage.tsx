// components/auth/RegisterPage.tsx
// This component renders the Registration form UI.
"use client" // This directive is essential as this component uses useState and other client-side features.

import type React from "react"
import { useState } from "react"
import { supabase } from "@/lib/supabase" // Import the Supabase client
import { FiMail, FiLock, FiEye, FiEyeOff, FiMapPin, FiCompass } from "react-icons/fi" // React Icons for input fields and eye toggles

// Define props interface for RegisterPage.
// It expects a function `onBackToLogin` to allow navigation back to the login screen.
interface RegisterPageProps {
  onBackToLogin: () => void
}

export default function RegisterPage({ onBackToLogin }: RegisterPageProps) {
  const [email, setEmail] = useState<string>("") // State for email input
  const [password, setPassword] = useState<string>("") // State for password input
  const [confirmPassword, setConfirmPassword] = useState<string>("") // State for confirm password input
  const [loading, setLoading] = useState<boolean>(false) // State for loading indicator
  const [message, setMessage] = useState<string>("") // State for success/error messages
  const [showPassword, setShowPassword] = useState<boolean>(false) // NEW: State for password visibility
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false) // NEW: State for confirm password visibility

  /**
   * Handles the user registration process.
   * @param e - The form submission event.
   */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault() // Prevent default form submission
    setLoading(true) // Enable loading state
    setMessage("") // Clear previous messages

    // Client-side validation: Check if passwords match
    if (password !== confirmPassword) {
      setMessage("Error: Passwords do not match!")
      setLoading(false)
      return // Stop the registration process
    }

    try {
      // Call Supabase's signUp method to register a new user.
      // Supabase handles email verification by default, which is why a confirmation email is mentioned.
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        // Display error message if registration fails.
        setMessage(`Error: ${error.message}`)
      } else {
        // On successful registration, prompt user to check email for confirmation.
        setMessage("Registration successful! Please check your email to confirm your account, then log in.")
        // Optionally, you could automatically redirect to login after a short delay:
        // setTimeout(() => onBackToLogin(), 3000);
      }
    } catch (error: any) {
      // Catch any unexpected errors
      setMessage(`An unexpected error occurred: ${error.message}`)
    } finally {
      setLoading(false) // Disable loading state
    }
  }

  // Render the Registration form UI
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-sky-50 via-blue-50 to-emerald-50 p-6">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-10 left-10 w-32 h-32 bg-sky-300 rounded-full blur-3xl"></div>
        <div className="absolute top-40 right-20 w-48 h-48 bg-emerald-300 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-1/4 w-40 h-40 bg-amber-300 rounded-full blur-3xl"></div>
        <div className="absolute bottom-40 right-10 w-36 h-36 bg-sky-400 rounded-full blur-3xl"></div>
      </div>

      {/* Background Image Container */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: "url('/smart-city-guide login.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-sky-100/30 to-emerald-100/30"></div>
      </div>

      {/* Register Card Container - Now Horizontal */}
      <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl w-full max-w-sm md:max-w-4xl z-10 border border-white/20 overflow-hidden">
        <div className="flex flex-col md:flex-row">
          {/* Left Side - Welcome Section */}
          <div className="flex-1 bg-gradient-to-br from-sky-500 to-emerald-500 p-8 flex flex-col justify-center items-center text-white relative overflow-hidden text-center py-12 md:py-8">
            {/* Background Pattern for Left Side */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 left-4 w-20 h-20 bg-white rounded-full blur-2xl"></div>
              <div className="absolute bottom-8 right-8 w-32 h-32 bg-white rounded-full blur-3xl"></div>
              <div className="absolute top-1/2 left-1/2 w-16 h-16 bg-white rounded-full blur-xl"></div>
            </div>

            <div className="relative z-10 text-center">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <FiCompass className="text-white text-3xl" />
              </div>
              <h2 className="text-3xl font-bold mb-4">Welcome Explorer!</h2>
              <p className="text-sky-100 text-lg mb-6 leading-relaxed">
                Join thousands of travelers discovering amazing destinations with our smart guide
              </p>
              <div className="flex items-center justify-center space-x-6 text-sky-100">
                <div className="text-center">
                  <div className="text-2xl font-bold">50K+</div>
                  <div className="text-sm">Happy Travelers</div>
                </div>
                <div className="w-px h-12 bg-sky-200/30"></div>
                <div className="text-center">
                  <div className="text-2xl font-bold">200+</div>
                  <div className="text-sm">Destinations</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Registration Form */}
          <div className="flex-1 p-8 flex flex-col justify-center w-full">
            <div className="max-w-sm mx-auto w-full">
              {/* Header */}
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Create Account</h3>
                <p className="text-slate-600 text-sm">Start your journey today</p>
              </div>

              {/* Registration Form */}
              <form onSubmit={handleRegister} className="space-y-4">
                {/* Email Input Field */}
                <div className="relative group">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-500 transition-colors duration-200 w-4 h-4" />
                    <input
                      type="email"
                      placeholder="Enter your email"
                      className="pl-10 pr-4 py-3 w-full border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent text-slate-700 transition-all duration-200 bg-white/70 backdrop-blur-sm hover:bg-white/90 text-sm"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Password Input Field with Toggle */}
                <div className="relative group">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-500 transition-colors duration-200 w-4 h-4" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password"
                      className="pl-10 pr-10 py-3 w-full border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent text-slate-700 transition-all duration-200 bg-white/70 backdrop-blur-sm hover:bg-white/90 text-sm"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors duration-200"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Input Field with Toggle */}
                <div className="relative group">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Confirm Password</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-500 transition-colors duration-200 w-4 h-4" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      className="pl-10 pr-10 py-3 w-full border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent text-slate-700 transition-all duration-200 bg-white/70 backdrop-blur-sm hover:bg-white/90 text-sm"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors duration-200"
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                      {showConfirmPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Register Button */}
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-semibold py-3 rounded-lg shadow-lg transition-all duration-300 ease-in-out transform hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2 text-sm"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <FiMapPin className="w-4 h-4" />
                      <span>Start Your Journey</span>
                    </>
                  )}
                </button>
              </form>

              {/* Message Display */}
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

              {/* Back to Login Button */}
              <div className="mt-6 text-center">
                <p className="text-slate-600 text-xs mb-2">Already have an account?</p>
                <button
                  onClick={onBackToLogin}
                  className="text-sky-600 hover:text-sky-700 font-semibold transition-colors duration-200 hover:underline decoration-2 underline-offset-2 text-sm"
                >
                  Sign In Instead
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Elements for Visual Appeal */}
      <div className="absolute top-20 left-20 w-2 h-2 bg-sky-400 rounded-full opacity-60 animate-pulse"></div>
      <div className="absolute top-32 right-32 w-1.5 h-1.5 bg-emerald-400 rounded-full opacity-60 animate-pulse delay-1000"></div>
      <div className="absolute bottom-24 left-32 w-3 h-3 bg-amber-400 rounded-full opacity-60 animate-pulse delay-500"></div>
      <div className="absolute bottom-40 right-24 w-1.5 h-1.5 bg-sky-500 rounded-full opacity-60 animate-pulse delay-700"></div>
    </div>
  )
}
