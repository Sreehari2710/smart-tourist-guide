"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"

// Import React Icons for various dashboard elements
import {
  FiMap,
  FiPlusCircle,
  FiClock,
  FiMessageSquare,
  FiExternalLink,
  FiTrash2,
  FiX,
  FiCalendar,
  FiMapPin,
  FiUsers,
  FiStar,
  FiHeart,
  FiTrendingUp,
  FiMenu,
} from "react-icons/fi"
import {
  FaLandmark,
  FaTree,
  FaSpa,
  FaPaintBrush,
  FaUtensils,
  FaFlag,
  FaCoffee,
  FaShoppingCart,
  FaStar as FaStarSolid,
  FaPlane,
  FaCompass,
  FaRoute,
} from "react-icons/fa"

// Define the structure of a Trip item as stored in Supabase
interface Trip {
  id: string
  user_id: string
  destination: string
  travel_date: string
  duration: number
  interests: string[]
  suggested_places: Array<{ name: string; description: string }>
  created_at: string
  time_per_day?: number
  use_current_location?: boolean
  preferred_travel_mode?: string
  shortest_route_optimization?: boolean
  show_top_rated_places?: boolean
  avoid_crowded_places?: boolean
  send_email_copy?: boolean
}

// Define the shape of an interest item
interface Interest {
  id: string
  name: string
  icon: React.ElementType
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState<boolean>(true)
  const [upcomingTrips, setUpcomingTrips] = useState<Trip[]>([])
  const [loadingTrips, setLoadingTrips] = useState<boolean>(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false)
  const [tripToDelete, setTripToDelete] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)

  // Feedback Modal States
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false)
  const [feedbackRating, setFeedbackRating] = useState<number>(0)
  const [feedbackText, setFeedbackText] = useState<string>("")
  const [submittingFeedback, setSubmittingFeedback] = useState<boolean>(false)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [feedbackMessageType, setFeedbackMessageType] = useState<"success" | "error" | null>(null)

  // Support Modal States
  const [showSupportModal, setShowSupportModal] = useState<boolean>(false)
  const [supportIssue, setSupportIssue] = useState<string>("")
  const [submittingSupport, setSubmittingSupport] = useState<boolean>(false)
  const [supportMessage, setSupportMessage] = useState<string | null>(null)
  const [supportMessageType, setSupportMessageType] = useState<"success" | "error" | null>(null)

  // Define available interests with their icons
  const interests: Interest[] = [
    { id: "historical_places", name: "Historical Places", icon: FaLandmark },
    { id: "temples", name: "Temples", icon: FaLandmark },
    { id: "adventure_parks", name: "Adventure Parks", icon: FaFlag },
    { id: "cafes", name: "Cafes", icon: FaCoffee },
    { id: "shopping", name: "Shopping", icon: FaShoppingCart },
    { id: "nature_parks", name: "Nature/Parks", icon: FaTree },
    { id: "wellness_spas", name: "Wellness/Spas", icon: FaSpa },
    { id: "art_museums", name: "Art & Museums", icon: FaPaintBrush },
    { id: "food_local_cuisine", name: "Food & Local Cuisine", icon: FaUtensils },
  ]

  // Effect hook to handle authentication status and user redirection
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/")
      } else {
        setUser(user)
      }
      setLoadingUser(false)
    }

    checkUser()

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        router.push("/")
      } else if (session) {
        setUser(session.user)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [router])

  // Effect hook to fetch trips once the user is loaded
  useEffect(() => {
    const fetchTrips = async () => {
      if (user) {
        setLoadingTrips(true)
        const today = new Date()
        const year = today.getFullYear()
        const month = String(today.getMonth() + 1).padStart(2, "0")
        const day = String(today.getDate()).padStart(2, "0")
        const todayFormatted = `${year}-${month}-${day}`

        const { data, error } = await supabase
          .from("trips")
          .select("*")
          .eq("user_id", user.id)
          .gte("travel_date", todayFormatted)
          .order("travel_date", { ascending: true })

        if (error) {
          console.error("Error fetching trips:", error.message)
        } else {
          setUpcomingTrips(data as Trip[])
        }
        setLoadingTrips(false)
      }
    }

    if (user) {
      fetchTrips()
    }
  }, [user])

  const handleLogout = async () => {
    setLoadingUser(true)
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error("Error logging out:", error.message)
      setLoadingUser(false)
    } else {
      router.push("/")
    }
  }

  const handleDeleteTrip = async () => {
    if (tripToDelete) {
      setLoading(true)
      try {
        const { error } = await supabase.from("trips").delete().eq("id", tripToDelete).eq("user_id", user?.id)

        if (error) {
          throw new Error(`Failed to delete trip: ${error.message}`)
        }

        setUpcomingTrips((prevTrips) => prevTrips.filter((trip) => trip.id !== tripToDelete))
        console.log(`Trip with ID ${tripToDelete} deleted successfully.`)
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error)
        console.error("Error deleting trip:", errMsg)
      } finally {
        setLoading(false)
        setShowDeleteConfirm(false)
        setTripToDelete(null)
      }
    }
  }

  const handleSubmitFeedback = async () => {
    if (!user) {
      setFeedbackMessage("Error: User not authenticated. Please log in.")
      setFeedbackMessageType("error")
      return
    }
    if (feedbackRating === 0) {
      setFeedbackMessage("Please select a star rating.")
      setFeedbackMessageType("error")
      return
    }

    setSubmittingFeedback(true)
    setFeedbackMessage(null)
    setFeedbackMessageType(null)

    try {
      const { error } = await supabase.from("user_feedback").insert({
        user_id: user.id,
        rating: feedbackRating,
        feedback_text: feedbackText.trim() === "" ? null : feedbackText.trim(),
      })

      if (error) {
        throw new Error(`Failed to submit feedback: ${error.message}`)
      }

      setFeedbackMessage("Thank you for your feedback!")
      setFeedbackMessageType("success")
      setFeedbackRating(0)
      setFeedbackText("")
      setTimeout(() => {
        setShowFeedbackModal(false)
        setFeedbackMessage(null)
      }, 2000)
    } catch (error: any) {
      console.error("Error submitting feedback:", error.message)
      setFeedbackMessage(`Error: ${error.message}`)
      setFeedbackMessageType("error")
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const handleSubmitSupport = async () => {
    if (!user) {
      setSupportMessage("Error: User not authenticated. Please log in.")
      setSupportMessageType("error")
      return
    }
    if (supportIssue.trim() === "") {
      setSupportMessage("Please describe your issue.")
      setSupportMessageType("error")
      return
    }

    setSubmittingSupport(true)
    setSupportMessage(null)
    setSupportMessageType(null)

    try {
      const { error } = await supabase.from("customer_support_requests").insert({
        user_id: user.id,
        issue_description: supportIssue.trim(),
        status: "pending",
      })

      if (error) {
        throw new Error(`Failed to submit support request: ${error.message}`)
      }

      setSupportMessage("Thank you for reaching out! We have received your request and will get back to you soon.")
      setSupportMessageType("success")
      setSupportIssue("")
      setTimeout(() => {
        setShowSupportModal(false)
        setSupportMessage(null)
      }, 3000)
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.error("Error submitting support request:", errMsg)
      setSupportMessage(`Error: ${errMsg}`)
      setSupportMessageType("error")
    } finally {
      setSubmittingSupport(false)
    }
  }

  const navigateTo = (path: string) => {
    router.push(path)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-emerald-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4"></div>
          <p className="text-slate-600 text-lg font-medium">Loading your travel dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div
      className="min-h-screen transition-colors duration-300 bg-gradient-to-br from-sky-50 via-white to-emerald-50 text-slate-800"
    >
      {/* Top Navigation Bar */}
      <nav
        className="backdrop-blur-md border-b shadow-sm sticky top-0 z-50 transition-colors duration-300 bg-white/80 border-sky-100"
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-emerald-400 rounded-xl flex items-center justify-center">
                <FaCompass className="text-white text-lg" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-sky-600 to-emerald-600 bg-clip-text text-transparent">
                Smart Travel Guide
              </h1>
            </div>
            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center space-x-1">
              {[
                { label: "Dashboard", path: "/dashboard" },
                { label: "Plan Trip", path: "/plan-trip" },
              ].map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigateTo(item.path)}
                  className="px-4 py-2 rounded-lg transition-all duration-200 font-medium text-slate-600 hover:text-sky-600 hover:bg-sky-50"
                >
                  {item.label}
                </button>
              ))}
              <button
                onClick={handleLogout}
                className="ml-4 px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-lg hover:from-rose-600 hover:to-pink-600 transition-all duration-200 font-medium shadow-sm"
                disabled={loadingUser}
              >
                Logout
              </button>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-lg transition-all duration-200 text-slate-600"
              >
                {isMenuOpen ? <FiX className="h-7 w-7" /> : <FiMenu className="h-7 w-7" />}
              </button>
            </div>
          </div>
        </div>
        {/* Mobile Menu Dropdown */}
        {isMenuOpen && (
          <div className="md:hidden pb-4 pt-2 border-b shadow-sm bg-white/90 border-sky-100">
            <div className="flex flex-col items-center space-y-2">
              {[
                { label: "Dashboard", path: "/dashboard" },
                { label: "Plan Trip", path: "/plan-trip" },
              ].map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    navigateTo(item.path)
                    setIsMenuOpen(false)
                  }}
                  className="w-full text-center px-4 py-2 rounded-lg transition-all duration-200 font-medium text-slate-700 hover:text-sky-700 hover:bg-sky-50"
                >
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => {
                  handleLogout()
                  setIsMenuOpen(false)
                }}
                className="w-full text-center mt-2 px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-lg hover:from-rose-600 hover:to-pink-600 transition-all duration-200 font-medium shadow-sm"
                disabled={loadingUser}
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div
          className="backdrop-blur-sm rounded-2xl shadow-xl border p-8 mb-8 transition-colors duration-300 bg-white/70 border-white/50"
        >
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-4 md:mb-0 text-center md:text-left">
              <h2 className="text-3xl sm:text-4xl font-bold mb-2 flex items-center justify-center md:justify-start">
                <FaPlane className="text-sky-500 mr-4 transform rotate-12" />
                Welcome back, {user.email?.split("@")[0]}!
              </h2>
              <p className="text-lg sm:text-xl text-slate-600">
                Ready to explore a new destination today?
              </p>
            </div>
            <div className="hidden md:block flex-shrink-0">
              <div className="w-24 h-24 bg-gradient-to-br from-sky-400 to-emerald-400 rounded-full flex items-center justify-center">
                <FaCompass className="text-white text-3xl animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { icon: FiMapPin, label: "Destinations", value: upcomingTrips.length, color: "sky" },
            {
              icon: FiCalendar,
              label: "Days Planned",
              value: upcomingTrips.reduce((acc, trip) => acc + trip.duration, 0),
              color: "emerald",
            },
            {
              icon: FiUsers,
              label: "Places to Visit",
              value: upcomingTrips.reduce((acc, trip) => acc + (trip.suggested_places?.length || 0), 0),
              color: "amber",
            },
            {
              icon: FiHeart,
              label: "Adventures Ahead",
              value: upcomingTrips.filter((trip) => trip.interests.includes("adventure_parks")).length,
              color: "rose",
            },
          ].map((stat, index) => (
            <div
              key={index}
              className="backdrop-blur-sm rounded-2xl shadow-lg border p-6 transition-all duration-300 hover:scale-105 bg-white/70 border-white/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">
                    {stat.label}
                  </p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <div
                  className={`w-12 h-12 bg-gradient-to-br from-${stat.color}-400 to-${stat.color}-500 rounded-xl flex items-center justify-center`}
                >
                  <stat.icon className="text-white text-xl" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Access Cards */}
        {/* Changed grid-cols-1 sm:grid-cols-2 md:grid-cols-3 to flex flex-wrap justify-center
            to center the cards and allow them to wrap on smaller screens. */}
        <div className="flex flex-wrap justify-center gap-6 mb-8">
          {[
            {
              icon: FiPlusCircle,
              title: "Plan a New Trip",
              description: "Create your next adventure",
              path: "/plan-trip",
              gradient: "from-sky-500 to-emerald-500",
            },
            {
              icon: FiClock,
              title: "My Past Plans",
              description: "Relive your memories",
              path: "/past-plans",
              gradient: "from-amber-500 to-orange-500",
            },
          ].map((card, index) => (
            <div
              key={index}
              onClick={() => navigateTo(card.path)}
              className="group backdrop-blur-sm rounded-2xl shadow-xl border p-8 cursor-pointer transition-all duration-300 transform hover:scale-105 hover:shadow-2xl bg-white/70 border-white/50 hover:bg-white/80 w-full max-w-sm" // w-full max-w-sm ensures consistent card size
            >
              <div className="text-center">
                <div
                  className={`w-16 h-16 bg-gradient-to-r ${card.gradient} rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <card.icon className="text-white text-2xl" />
                </div>
                <h3 className="text-xl font-bold mb-2">{card.title}</h3>
                <p className="text-slate-600">{card.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Upcoming Trips */}
        <div
          className="backdrop-blur-sm rounded-2xl shadow-xl border p-8 mb-8 transition-colors duration-300 bg-white/70 border-white/50"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
            <h3 className="text-2xl sm:text-3xl font-bold flex items-center mb-3 sm:mb-0 text-center sm:text-left w-full sm:w-auto justify-center sm:justify-start">
              <FiTrendingUp className="text-emerald-500 mr-3" />
              Upcoming Adventures
            </h3>
            {upcomingTrips.length > 0 && (
              <span
                className="px-3 py-1 rounded-full text-sm font-medium mt-2 sm:mt-0 bg-emerald-100 text-emerald-700"
              >
                {upcomingTrips.length} trip{upcomingTrips.length !== 1 ? "s" : ""} planned
              </span>
            )}
          </div>

          {loadingTrips ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4"></div>
              <p className="text-slate-500">Loading your adventures...</p>
            </div>
          ) : upcomingTrips.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gradient-to-br from-sky-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaPlane className="text-sky-500 text-3xl transform rotate-12" />
              </div>
              <h4 className="text-xl sm:text-2xl font-bold mb-4">No Adventures Planned Yet</h4>
              <p className="text-base sm:text-lg mb-6 text-slate-600">
                Start planning your next amazing journey!
              </p>
              <button
                onClick={() => navigateTo("/plan-trip")}
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 w-full sm:w-auto"
              >
                <FiPlusCircle className="mr-3" />
                Plan Your First Trip
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {upcomingTrips.map((trip) => (
                <div
                  key={trip.id}
                  className="group border rounded-2xl p-6 transition-all duration-300 hover:shadow-lg border-sky-100 bg-gradient-to-r from-white to-sky-50/50 hover:from-sky-50 hover:to-emerald-50"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
                        <div className="flex items-center space-x-3 mb-4 sm:mb-0">
                          <div className="w-12 h-12 bg-gradient-to-br from-sky-400 to-emerald-400 rounded-xl flex items-center justify-center">
                            <FiMapPin className="text-white text-xl" />
                          </div>
                          <div>
                            <h4 className="text-xl font-bold">{trip.destination}</h4>
                            <div
                              className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 text-sm text-slate-600"
                            >
                              <span className="flex items-center">
                                <FiCalendar className="mr-1" />
                                {formatDate(trip.travel_date)}
                              </span>
                              <span className="flex items-center">
                                <FiClock className="mr-1" />
                                {trip.duration} day{trip.duration !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Interests */}
                      <div className="mb-4">
                        <p className="text-sm font-medium mb-2 text-slate-700">
                          Interests:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {trip.interests.slice(0, 4).map((interestId) => {
                            const interest = interests.find((i) => i.id === interestId)
                            if (!interest) return null
                            return (
                              <span
                                key={interestId}
                                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-sky-100 text-sky-700"
                              >
                                <interest.icon className="mr-1 text-xs" />
                                {interest.name}
                              </span>
                            )
                          })}
                          {trip.interests.length > 4 && (
                            <span
                              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600"
                            >
                              +{trip.interests.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Suggested Places Preview */}
                      {trip.suggested_places && trip.suggested_places.length > 0 && (
                        <div
                          className="rounded-xl p-4 border bg-gradient-to-r from-emerald-50 to-sky-50 border-emerald-100"
                        >
                          <p
                            className="text-sm font-medium mb-2 flex items-center text-slate-700"
                          >
                            <FaRoute className="mr-2 text-emerald-500" />
                            Places to visit:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {trip.suggested_places.slice(0, 3).map((place, placeIndex) => (
                              <div
                                key={placeIndex}
                                className="text-xs p-2 rounded-lg bg-white/70 text-slate-600"
                              >
                                <span className="font-medium">{place.name}</span>
                              </div>
                            ))}
                          </div>
                          {trip.suggested_places.length > 3 && (
                            <p className="text-xs mt-2 text-slate-500">
                              ...and {trip.suggested_places.length - 3} more amazing places!
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 lg:flex-col lg:w-48 w-full">
                      <button
                        onClick={() => navigateTo(`/trip/${trip.id}`)}
                        className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 w-full"
                      >
                        <FiExternalLink className="mr-2" />
                        View Plan
                      </button>
                      <button
                        onClick={() => navigateTo(`/view-map?tripId=${trip.id}`)}
                        className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 w-full"
                      >
                        <FiMap className="mr-2" />
                        View Map
                      </button>
                      <button
                        onClick={() => {
                          setTripToDelete(trip.id)
                          setShowDeleteConfirm(true)
                        }}
                        className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 w-full"
                        disabled={loading}
                      >
                        <FiTrash2 className="mr-2" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Support & Feedback */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div
            onClick={() => setShowSupportModal(true)}
            className="group backdrop-blur-sm rounded-2xl shadow-xl border p-8 cursor-pointer transition-all duration-300 transform hover:scale-105 hover:shadow-2xl bg-white/70 border-white/50 hover:bg-white/80"
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <FiMessageSquare className="text-white text-2xl" />
              </div>
              <h3 className="text-xl font-bold mb-2">Need Help?</h3>
              <p className="mb-4 text-slate-600">
                Get support with your travel plans
              </p>
              <button className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg shadow-sm transition-all duration-200 font-medium w-full sm:w-auto">
                Contact Support
              </button>
            </div>
          </div>

          <div
            onClick={() => setShowFeedbackModal(true)}
            className="group backdrop-blur-sm rounded-2xl shadow-xl border p-8 cursor-pointer transition-all duration-300 transform hover:scale-105 hover:shadow-2xl bg-white/70 border-white/50 hover:bg-white/80"
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <FiStar className="text-white text-2xl" />
              </div>
              <h3 className="text-xl font-bold mb-2">Share Your Experience</h3>
              <p className="mb-4 text-slate-600">Help us improve our service</p>
              <button className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg shadow-sm transition-all duration-200 font-medium w-full sm:w-auto">
                Give Feedback
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className="rounded-2xl shadow-2xl p-8 text-center max-w-md w-full bg-white"
          >
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiTrash2 className="text-rose-500 text-2xl" />
            </div>
            <h3 className="text-2xl font-bold mb-4">Confirm Deletion</h3>
            <p className="mb-6 text-slate-600">
              Are you sure you want to delete this trip? This action cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 w-full">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-6 py-3 rounded-xl font-medium transition-colors w-full sm:w-auto bg-slate-200 text-slate-800 hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTrip}
                className="px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-xl font-medium transition-all duration-200 w-full sm:w-auto"
                disabled={loading}
              >
                {loading ? "Deleting..." : "Delete Trip"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className="rounded-2xl shadow-2xl p-8 w-full max-w-md relative bg-white"
          >
            <button
              onClick={() => {
                setShowFeedbackModal(false)
                setFeedbackRating(0)
                setFeedbackText("")
                setFeedbackMessage(null)
              }}
              className="absolute top-4 right-4 p-2 rounded-lg transition-colors text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              disabled={submittingFeedback}
            >
              <FiX className="text-xl" />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiStar className="text-white text-2xl" />
              </div>
              <h3 className="text-2xl font-bold">Share Your Experience</h3>
            </div>

            {feedbackMessage && (
              <div
                className={`p-4 rounded-xl text-center mb-6 ${
                  feedbackMessageType === "success"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {feedbackMessage}
              </div>
            )}

            {/* Star Rating */}
            <div className="mb-6 text-center">
              <label className="block text-lg font-semibold mb-3 text-slate-700">
                Your Rating:
              </label>
              <div className="flex justify-center space-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <FaStarSolid
                    key={star}
                    className={`text-3xl cursor-pointer transition-all duration-200 ${
                      feedbackRating >= star
                        ? "text-amber-400 scale-110"
                        : "text-slate-300 hover:text-amber-300"
                    }`}
                    onClick={() => setFeedbackRating(star)}
                  />
                ))}
              </div>
            </div>

            {/* Feedback Textarea */}
            <div className="mb-6">
              <label
                htmlFor="feedbackText"
                className="block text-lg font-semibold mb-2 text-slate-700"
              >
                Your Feedback:
              </label>
              <textarea
                id="feedbackText"
                className="w-full p-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200 bg-white border-slate-300 text-slate-700 placeholder-slate-500"
                rows={4}
                placeholder="Tell us about your experience..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                disabled={submittingFeedback}
              />
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-4 w-full">
              <button
                onClick={() => {
                  setShowFeedbackModal(false)
                  setFeedbackRating(0)
                  setFeedbackText("")
                  setFeedbackMessage(null)
                }}
                className="px-6 py-3 rounded-xl font-medium transition-colors w-full sm:w-auto bg-slate-200 text-slate-800 hover:bg-slate-300"
                disabled={submittingFeedback}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitFeedback}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                disabled={submittingFeedback || feedbackRating === 0}
              >
                {submittingFeedback ? "Submitting..." : "Submit Feedback"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Support Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className="rounded-2xl shadow-2xl p-8 w-full max-w-md relative bg-white"
          >
            <button
              onClick={() => {
                setShowSupportModal(false)
                setSupportIssue("")
                setSupportMessage(null)
              }}
              className="absolute top-4 right-4 p-2 rounded-lg transition-colors text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              disabled={submittingSupport}
            >
              <FiX className="text-xl" />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiMessageSquare className="text-white text-2xl" />
              </div>
              <h3 className="text-2xl font-bold">Contact Support</h3>
            </div>

            {supportMessage && (
              <div
                className={`p-4 rounded-xl text-center mb-6 ${
                  supportMessageType === "success"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {supportMessage}
              </div>
            )}

            {/* Support Issue Textarea */}
            <div className="mb-6">
              <label
                htmlFor="supportIssue"
                className="block text-lg font-semibold mb-2 text-slate-700"
              >
                Describe Your Issue:
              </label>
              <textarea
                id="supportIssue"
                className="w-full p-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200 bg-white border-slate-300 text-slate-700 placeholder-slate-500"
                rows={6}
                placeholder="Please provide a detailed description of the problem you are facing..."
                value={supportIssue}
                onChange={(e) => setSupportIssue(e.target.value)}
                disabled={submittingSupport || supportMessageType === "success"}
              />
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-4 w-full">
              <button
                onClick={() => {
                  setShowSupportModal(false)
                  setSupportIssue("")
                  setSupportMessage(null)
                }}
                className="px-6 py-3 rounded-xl font-medium transition-colors w-full sm:w-auto bg-slate-200 text-slate-800 hover:bg-slate-300"
                disabled={submittingSupport || supportMessageType === "success"}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitSupport}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                disabled={submittingSupport || supportIssue.trim() === "" || supportMessageType === "success"}
              >
                {submittingSupport ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
