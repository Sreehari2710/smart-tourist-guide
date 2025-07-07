"use client"
import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"
import { FiExternalLink, FiClock, FiMapPin, FiCalendar, FiRefreshCcw, FiTrash2, FiX, FiMenu } from "react-icons/fi"
import {
  FaLandmark,
  FaTree,
  FaSpa,
  FaPaintBrush,
  FaUtensils,
  FaFlag,
  FaCoffee,
  FaShoppingCart,
  FaMap,
  FaPlane,
  FaCompass,
} from "react-icons/fa"

// Define the structure of a Trip item (consistent with other pages)
interface Trip {
  id: string
  user_id: string
  destination: string
  travel_date: string // Stored as 'YYYY-MM-DD'
  duration: number
  interests: string[] // Array of interest IDs
  suggested_places: Array<{ name: string; description: string }> // JSONB column
  created_at: string
  time_per_day?: number
  preferred_travel_mode?: string
  shortest_route_optimization?: boolean
  show_top_rated_places?: boolean
  avoid_crowded_places?: boolean
  send_email_copy?: boolean
}

// Define the shape of an interest item (consistent with other pages)
interface Interest {
  id: string
  name: string
  icon: React.ElementType // Type for React Icon component
}

export default function PastPlansPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState<boolean>(true)
  const [pastTrips, setPastTrips] = useState<Trip[]>([])
  const [loadingTrips, setLoadingTrips] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false)
  const [tripToDelete, setTripToDelete] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  // Define available interests with their icons (consistent with other pages)
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

  // Authenticate user
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

  // Fetch all trips for the user
  useEffect(() => {
    const fetchTrips = async () => {
      if (!user) return
      setLoadingTrips(true)
      setError(null)
      try {
        // Get today's date in 'YYYY-MM-DD' format for comparison
        const today = new Date()
        const year = today.getFullYear()
        const month = String(today.getMonth() + 1).padStart(2, "0") // Months are 0-indexed
        const day = String(today.getDate()).padStart(2, "0")
        const todayFormatted = `${year}-${month}-${day}`
        const { data, error: fetchError } = await supabase
          .from("trips")
          .select("*")
          .eq("user_id", user.id)
          .lt("travel_date", todayFormatted) // Filter: only show trips where travel_date is less than today
          .order("travel_date", { ascending: false }) // Order by date, newest first
        if (fetchError) {
          console.error("Error fetching past trips:", fetchError.message)
          setError("Failed to load your past trip plans.")
          setPastTrips([])
        } else {
          setPastTrips(data as Trip[])
        }
      } catch (err: unknown) {
        console.error("Unexpected error fetching trips:", (err as Error).message)
        setError("An unexpected error occurred while loading your trips.")
      } finally {
        setLoadingTrips(false)
      }
    }
    if (user) {
      fetchTrips()
    }
  }, [user])

  // Helper function for navigation in the top bar
  const navigateTo = (path: string) => {
    router.push(path)
    setIsMenuOpen(false)
  }

  // Handle trip deletion
  const handleDeleteTrip = async () => {
    if (tripToDelete) {
      setLoading(true)
      try {
        const { error } = await supabase.from("trips").delete().eq("id", tripToDelete).eq("user_id", user?.id)

        if (error) {
          throw new Error(`Failed to delete trip: ${error.message}`)
        }

        setPastTrips((prevTrips) => prevTrips.filter((trip) => trip.id !== tripToDelete))
        console.log(`Trip with ID ${tripToDelete} deleted successfully.`)
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error)
        console.error("Error deleting trip:", errMsg)
        setError("An unexpected error occurred while deleting the trip.")
      } finally {
        setLoading(false)
        setShowDeleteConfirm(false)
        setTripToDelete(null)
      }
    }
  }

  // Format date for better display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  if (loadingUser || loadingTrips) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-emerald-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4"></div>
          <p className="text-slate-600 text-lg font-medium">Loading your travel memories...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-orange-50">
        <div className="text-center bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiMapPin className="text-rose-500 text-2xl" />
          </div>
          <p className="text-rose-700 text-lg font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Should redirect by useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50">
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
                onClick={() => supabase.auth.signOut().then(() => router.push("/"))}
                className="ml-4 px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-lg hover:from-rose-600 hover:to-pink-600 transition-all duration-200 font-medium shadow-sm"
              >
                Logout
              </button>
            </div>

            {/* Mobile menu button */}
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
                  supabase.auth.signOut().then(() => router.push("/"))
                  setIsMenuOpen(false)
                }}
                className="w-full text-center mt-2 px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-lg hover:from-rose-600 hover:to-pink-600 transition-all duration-200 font-medium shadow-sm"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-400 rounded-2xl shadow-lg mb-6">
            <FiClock className="text-white text-2xl" />
          </div>
          <h2 className="text-4xl font-bold text-slate-800 mb-4">Travel Memories</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Relive your past adventures and get inspired for your next journey
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 p-4 sm:p-8">
          {pastTrips.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gradient-to-br from-sky-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaPlane className="text-sky-500 text-3xl transform rotate-12" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-4">No Past Adventures Yet</h3>
              <p className="text-slate-600 text-lg mb-8 max-w-md mx-auto">
                Your travel history will appear here once you&apos;ve completed some trips. Start planning your first
                adventure!
              </p>
              <button
                onClick={() => navigateTo("/plan-trip")}
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                <FaCompass className="mr-3" />
                Plan Your First Trip
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold text-slate-800">
                  Your Adventures ({pastTrips.length} trip{pastTrips.length !== 1 ? "s" : ""})
                </h3>
                <div className="flex items-center text-sm text-slate-500">
                  <FiCalendar className="mr-2" />
                  Sorted by most recent
                </div>
              </div>
              <div className="grid gap-6">
                {pastTrips.map((trip, index) => (
                  <div
                    key={trip.id}
                    className="group bg-gradient-to-r from-white to-sky-50/50 border border-sky-100 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.01]"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                      {/* Trip Info */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-sky-400 to-emerald-400 rounded-xl flex items-center justify-center flex-shrink-0">
                              <span className="text-white font-bold text-lg">{index + 1}</span>
                            </div>
                            <div>
                              <h4 className="text-xl font-bold text-slate-800 flex items-center">
                                <FiMapPin className="text-sky-500 mr-2" />
                                {trip.destination}
                              </h4>
                              <div className="flex items-center space-x-4 text-sm text-slate-600 mt-1">
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
                          <p className="text-sm font-medium text-slate-700 mb-2">Interests explored:</p>
                          <div className="flex flex-wrap gap-2">
                            {trip.interests.slice(0, 4).map((interestId) => {
                              const interest = interests.find((i) => i.id === interestId)
                              if (!interest) return null
                              return (
                                <span
                                  key={interestId}
                                  className="inline-flex items-center px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-xs font-medium"
                                >
                                  <interest.icon className="mr-1 text-xs" />
                                  {interest.name}
                                </span>
                              )
                            })}
                            {trip.interests.length > 4 && (
                              <span className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                                +{trip.interests.length - 4} more
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Suggested Places Preview */}
                        {trip.suggested_places && trip.suggested_places.length > 0 && (
                          <div className="bg-gradient-to-r from-emerald-50 to-sky-50 rounded-xl p-4 border border-emerald-100">
                            <p className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                              <FaMap className="mr-2 text-emerald-500" />
                              Places you visited:
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {trip.suggested_places.slice(0, 3).map((place, placeIndex) => (
                                <div key={placeIndex} className="text-xs text-slate-600 bg-white/70 rounded-lg p-2">
                                  <span className="font-medium">{place.name}</span>
                                </div>
                              ))}
                            </div>
                            {trip.suggested_places.length > 3 && (
                              <p className="text-xs text-slate-500 mt-2">
                                ...and {trip.suggested_places.length - 3} more amazing places!
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Action Buttons */}
                      <div className="flex flex-col sm:flex-row gap-3 lg:flex-col">
                        <button
                          onClick={() => navigateTo(`/trip/${trip.id}`)}
                          className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105"
                        >
                          <FiExternalLink className="mr-2" />
                          View Details
                        </button>
                        <button
                          onClick={() => navigateTo(`/plan-trip?replanTripId=${trip.id}`)}
                          className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105"
                        >
                          <FiRefreshCcw className="mr-2" />
                          Plan Again
                        </button>
                        <button
                          onClick={() => {
                            setTripToDelete(trip.id)
                            setShowDeleteConfirm(true)
                          }}
                          className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 w-full"
                        >
                          <FiTrash2 className="mr-2" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Footer CTA */}
              <div className="text-center mt-12 p-4 sm:p-8 bg-gradient-to-r from-sky-50 to-emerald-50 rounded-2xl border border-sky-100">
                <h4 className="text-xl font-bold text-slate-800 mb-4">Ready for Your Next Adventure?</h4>
                <p className="text-slate-600 mb-6">
                  Use your past experiences to plan even better trips. Let AI help you discover new destinations!
                </p>
                <button
                  onClick={() => navigateTo("/plan-trip")}
                  className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                  <FaPlane className="mr-3" />
                  Plan New Adventure
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl shadow-2xl p-8 text-center max-w-md w-full bg-white">
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
    </div>
  )
}
