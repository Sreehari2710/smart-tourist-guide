"use client"
import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"
import { FiEdit, FiCheckCircle, FiXCircle, FiMail, FiClock, FiMapPin, FiCalendar, FiArrowLeft } from "react-icons/fi"
import { FaMap, FaPlane, FaCompass, FaRoute, FaStickyNote, FaCheckCircle } from "react-icons/fa"

// Define the structure of a SuggestedPlace (simplified, no Google Places API fields)
interface SuggestedPlace {
  name: string
  description: string
  notes?: string // User's custom notes for this place
  visited?: boolean // Whether the user has visited this place
}

// Define the structure of a Trip item
interface Trip {
  id: string
  user_id: string
  destination: string
  travel_date: string
  duration: number // Number of days
  interests: string[]
  suggested_places: SuggestedPlace[] // Array of SuggestedPlace objects
  created_at: string
  time_per_day?: number
  preferred_travel_mode?: string
  shortest_route_optimization?: boolean
  show_top_rated_places?: boolean
  avoid_crowded_places?: boolean
  send_email_copy?: boolean // This field might be used for general preference
}

export default function TripDetailPage() {
  const router = useRouter()
  const params = useParams()
  const tripId = params.tripId as string

  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState<boolean>(true)
  const [trip, setTrip] = useState<Trip | null>(null)
  const [loadingTrip, setLoadingTrip] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null)
  const [currentNote, setCurrentNote] = useState<string>("")
  const [savingNotes, setSavingNotes] = useState<boolean>(false)
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false) // New state for mobile menu

  // States for email sending functionality
  const [sendingEmail, setSendingEmail] = useState<boolean>(false)
  const [emailMessage, setEmailMessage] = useState<string | null>(null)
  const [emailMessageType, setEmailMessageType] = useState<"success" | "error" | null>(null)

  // Supabase URL (needed to call Edge Functions)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

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

  // Fetch trip details
  useEffect(() => {
    const fetchTripDetails = async () => {
      if (!user) return

      setLoadingTrip(true)
      setError(null)

      try {
        const { data: tripData, error: fetchError } = await supabase
          .from("trips")
          .select("*")
          .eq("id", tripId)
          .eq("user_id", user.id)
          .single()

        if (fetchError) {
          console.error("Error fetching trip details from Supabase:", fetchError.message)
          setError("Failed to load trip details: " + fetchError.message)
          setTrip(null)
          setLoadingTrip(false)
          return
        }

        if (!tripData) {
          setError("Trip not found or you do not have permission to view it.")
          setTrip(null)
          setLoadingTrip(false)
          return
        }

        // Initialize notes and visited status for existing places if they don't exist
        const initializedPlaces = tripData.suggested_places.map((place: SuggestedPlace) => ({
          ...place,
          notes: place.notes || "",
          visited: place.visited ?? false,
        }))

        setTrip({ ...tripData, suggested_places: initializedPlaces } as Trip)
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error("Error fetching trip details:", errMsg)
        setError(`Error fetching trip details: ${errMsg}.`)
      } finally {
        setLoadingTrip(false)
      }
    }

    if (user && tripId && !loadingUser) {
      // Ensure user is loaded before fetching
      fetchTripDetails()
    }
  }, [user, tripId])

  // Function to update a specific suggested place in Supabase
  const updatePlaceInSupabase = useCallback(
    async (updatedPlace: SuggestedPlace, index: number) => {
      if (!trip || !user) return

      setSavingNotes(true) // Indicate saving is in progress

      const newSuggestedPlaces = [...trip.suggested_places]
      newSuggestedPlaces[index] = updatedPlace

      try {
        const { error: updateError } = await supabase
          .from("trips")
          .update({ suggested_places: newSuggestedPlaces })
          .eq("id", trip.id)
          .eq("user_id", user.id)

        if (updateError) {
          console.error("Error updating suggested place in Supabase:", updateError.message)
          setError("Failed to save changes: " + updateError.message)
        } else {
          setTrip((prevTrip) => (prevTrip ? { ...prevTrip, suggested_places: newSuggestedPlaces } : null))
          setError(null) // Clear any previous errors
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error("Unexpected error during Supabase update:", errMsg)
        setError("An unexpected error occurred while saving.")
      } finally {
        setSavingNotes(false)
      }
    },
    [trip, user],
  )

  // Handle note editing
  const handleEditNote = (index: number, initialNote: string) => {
    setEditingNoteIndex(index)
    setCurrentNote(initialNote)
  }

  const handleSaveNote = async (index: number) => {
    if (!trip) return

    const updatedPlace = { ...trip.suggested_places[index], notes: currentNote }
    await updatePlaceInSupabase(updatedPlace, index)
    setEditingNoteIndex(null) // Exit editing mode
    setCurrentNote("") // Clear current note state
  }

  const handleCancelEdit = () => {
    setEditingNoteIndex(null)
    setCurrentNote("")
  }

  // Handle visited toggle
  const handleVisitedToggle = async (index: number) => {
    if (!trip) return

    const updatedPlace = { ...trip.suggested_places[index], visited: !trip.suggested_places[index].visited }
    await updatePlaceInSupabase(updatedPlace, index)
  }

  // Handle sending email copy of the trip plan
  const handleSendEmailCopy = async () => {
    if (!user || !trip) {
      setEmailMessage("Please log in or select a trip to send.")
      setEmailMessageType("error")
      return
    }

    setSendingEmail(true)
    setEmailMessage(null)
    setEmailMessageType(null)

    try {
      // Get the user's session to obtain the access token
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        throw new Error("User session not found. Please log in again.")
      }

      if (!supabaseUrl) {
        throw new Error("Supabase URL (NEXT_PUBLIC_SUPABASE_URL) is not set. Cannot call Edge Function.")
      }

      // Construct the Edge Function URL
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-trip-email`

      console.log("Attempting to call Edge Function:", edgeFunctionUrl) // Debugging: log the URL
      console.log("Sending trip data:", trip) // Debugging: log the trip data being sent
      console.log("Sending to email:", user.email) // Debugging: log the recipient email

      const response = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`, // Pass user's JWT
        },
        body: JSON.stringify({
          tripPlan: trip, // Send the entire trip object
          recipientEmail: user.email, // Send to the logged-in user's email
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Log detailed error from Edge Function if available
        console.error("Edge Function response error:", response.status, data)
        setEmailMessage(
          data.error || `Failed to send email (Status: ${response.status}). Check Supabase Edge Function logs.`,
        )
        setEmailMessageType("error")
      } else {
        setEmailMessage("Trip plan sent to your email successfully!")
        setEmailMessageType("success")
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.error("Error sending email:", errMsg)
      setEmailMessage(`Failed to send email: ${errMsg}`)
      setEmailMessageType("error")
    } finally {
      setSendingEmail(false)
    }
  }

  // Helper function for navigation in the top bar
  const navigateTo = (path: string) => {
    router.push(path)
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

  // Organize places by day
  const getPlacesByDay = (places: SuggestedPlace[], duration: number) => {
    const dailyItinerary: SuggestedPlace[][] = Array.from({ length: duration }, () => [])
    if (places.length === 0) return dailyItinerary

    const placesPerDay = Math.ceil(places.length / duration)
    let placeIndex = 0

    for (let day = 0; day < duration; day++) {
      for (let i = 0; i < placesPerDay; i++) {
        if (placeIndex < places.length) {
          dailyItinerary[day].push(places[placeIndex])
          placeIndex++
        } else {
          break
        }
      }
    }

    return dailyItinerary
  }

  if (loadingUser || loadingTrip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-emerald-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4"></div>
          <p className="text-slate-600 text-lg font-medium">Loading your adventure details...</p>
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
          <p className="text-rose-700 text-lg font-medium mb-4">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-6 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-sky-50">
        <div className="text-center bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaMap className="text-slate-500 text-2xl" />
          </div>
          <p className="text-slate-700 text-lg font-medium">No trip data available.</p>
        </div>
      </div>
    )
  }

  const dailyItinerary = getPlacesByDay(trip.suggested_places, trip.duration)
  const visitedCount = trip.suggested_places.filter((place) => place.visited).length
  const totalPlaces = trip.suggested_places.length

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-sky-100 shadow-sm sticky top-0 z-50">
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
                  className="px-4 py-2 text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all duration-200 font-medium"
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

            {/* Mobile Menu Button (Hamburger Icon) */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-slate-600 hover:text-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-400 p-2 rounded-md"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                  ></path>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {isMenuOpen && (
          <div className="md:hidden bg-white/90 backdrop-blur-md pb-4 pt-2">
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
                  className="w-full text-center px-4 py-3 text-slate-700 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-all duration-200 font-medium"
                >
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => supabase.auth.signOut().then(() => router.push("/"))}
                className="w-full text-center mt-2 px-4 py-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-lg hover:from-rose-600 hover:to-pink-600 transition-all duration-200 font-medium shadow-sm"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center text-slate-600 hover:text-sky-600 font-medium mb-6 transition-colors duration-200 group"
          >
            <FiArrowLeft className="mr-2 group-hover:-translate-x-1 transition-transform duration-200" />
            Back to Dashboard
          </button>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 p-8">
            <div className="flex flex-col md:flex-row items-start justify-between mb-6">
              <div className="w-full md:w-auto mb-6 md:mb-0">
                <h2 className="text-4xl font-bold text-slate-800 mb-4 flex items-center">
                  <FiMapPin className="text-sky-500 mr-3" />
                  {trip.destination}
                </h2>
                <div className="flex flex-wrap items-center gap-6 text-slate-600">
                  <div className="flex items-center">
                    <FiCalendar className="mr-2 text-emerald-500" />
                    <span>{formatDate(trip.travel_date)}</span>
                  </div>
                  <div className="flex items-center">
                    <FiClock className="mr-2 text-amber-500" />
                    <span>
                      {trip.duration} day{trip.duration !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <FaRoute className="mr-2 text-sky-500" />
                    <span>{trip.preferred_travel_mode?.replace("_", " ") || "Not specified"}</span>
                  </div>
                </div>
              </div>
              <div className="w-full md:w-48 text-left md:text-right">
                <div className="bg-gradient-to-r from-emerald-50 to-sky-50 rounded-xl p-4 border border-emerald-100">
                  <div className="text-2xl font-bold text-slate-800">
                    {visitedCount}/{totalPlaces}
                  </div>
                  <div className="text-sm text-slate-600">Places Visited</div>
                  <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-gradient-to-r from-emerald-400 to-sky-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${totalPlaces > 0 ? (visitedCount / totalPlaces) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {trip.time_per_day && (
              <div className="mb-4">
                <span className="inline-flex items-center px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                  <FiClock className="mr-1" />
                  {trip.time_per_day} hours per day
                </span>
              </div>
            )}

            <div className="mb-6">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Your Interests:</h4>
              <div className="flex flex-wrap gap-2">
                {trip.interests.map((interest, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-sm font-medium"
                  >
                    {interest.replace("_", " ")}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Daily Itinerary */}
        <div className="space-y-8">
          <div className="text-center mb-8">
            <h3 className="text-3xl font-bold text-slate-800 mb-4">Your Adventure Itinerary</h3>
            <p className="text-lg text-slate-600">Explore amazing places day by day</p>
          </div>

          {trip.suggested_places && trip.suggested_places.length > 0 ? (
            <div className="space-y-8">
              {dailyItinerary.map((dayPlaces, dayIndex) => (
                <div
                  key={`day-${dayIndex}`}
                  className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-sky-500 to-emerald-500 p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                      <h4 className="text-2xl font-bold text-white flex items-center mb-2 sm:mb-0">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mr-3">
                          <span className="text-white font-bold">{dayIndex + 1}</span>
                        </div>
                        Day {dayIndex + 1}
                      </h4>
                      <div className="text-white/80 text-sm">
                        {dayPlaces.filter((p) => p.visited).length}/{dayPlaces.length} completed
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    {dayPlaces.length > 0 ? (
                      <div className="space-y-6">
                        {dayPlaces.map((place, placeIndex) => {
                          // Find the original index of the place in the full suggested_places array
                          const originalIndex = trip.suggested_places.findIndex(
                            (p) => p.name === place.name && p.description === place.description,
                          )
                          return (
                            <div
                              key={originalIndex}
                              className={`group border-2 rounded-2xl p-6 transition-all duration-300 ${
                                place.visited
                                  ? "border-emerald-200 bg-gradient-to-r from-emerald-50 to-sky-50"
                                  : "border-slate-200 bg-white hover:border-sky-200 hover:shadow-lg"
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row items-start justify-between mb-4">
                                <div className="flex-1 w-full mb-4 sm:mb-0">
                                  <div className="flex items-center mb-2">
                                    <div
                                      className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                                        place.visited ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"
                                      }`}
                                    >
                                      {place.visited ? (
                                        <FaCheckCircle className="text-sm" />
                                      ) : (
                                        <span className="text-sm font-bold">{placeIndex + 1}</span>
                                      )}
                                    </div>
                                    <h5 className="text-xl font-bold text-slate-800">{place.name}</h5>
                                  </div>
                                  <p className="text-slate-600 mb-4 ml-11">{place.description}</p>
                                </div>
                                <label className="flex items-center cursor-pointer sm:ml-4">
                                  <input
                                    type="checkbox"
                                    checked={place.visited}
                                    onChange={() => handleVisitedToggle(originalIndex)}
                                    className="sr-only"
                                    disabled={savingNotes}
                                  />
                                  <div
                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                                      place.visited
                                        ? "border-emerald-500 bg-emerald-500"
                                        : "border-slate-300 hover:border-emerald-400"
                                    }`}
                                  >
                                    {place.visited && <FiCheckCircle className="text-white text-sm" />}
                                  </div>
                                  <span className="ml-2 text-sm text-slate-600">
                                    {place.visited ? "Visited" : "Mark as visited"}
                                  </span>
                                </label>
                              </div>

                              {/* Custom Notes Section */}
                              <div className="ml-0 sm:ml-11 pt-4 border-t border-slate-100">
                                <div className="flex items-center mb-2">
                                  <FaStickyNote className="text-amber-500 mr-2" />
                                  <span className="text-sm font-medium text-slate-700">Your Notes:</span>
                                </div>
                                {editingNoteIndex === originalIndex ? (
                                  <div className="space-y-3">
                                    <textarea
                                      className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent text-sm resize-none"
                                      rows={3}
                                      value={currentNote}
                                      onChange={(e) => setCurrentNote(e.target.value)}
                                      disabled={savingNotes}
                                      placeholder="Add your thoughts, tips, or memories about this place..."
                                    />
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                                      <button
                                        onClick={() => handleSaveNote(originalIndex)}
                                        className="flex items-center px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 text-sm font-medium w-full sm:w-auto"
                                        disabled={savingNotes}
                                      >
                                        <FiCheckCircle className="mr-1" />
                                        Save
                                      </button>
                                      <button
                                        onClick={handleCancelEdit}
                                        className="flex items-center px-4 py-2 bg-slate-400 text-white rounded-lg hover:bg-slate-500 transition-colors text-sm font-medium w-full sm:w-auto"
                                      >
                                        <FiXCircle className="mr-1" />
                                        Cancel
                                      </button>
                                    </div>
                                    {savingNotes && editingNoteIndex === originalIndex && (
                                      <p className="text-xs text-sky-600 flex items-center mt-2 sm:mt-0">
                                        <div className="animate-spin rounded-full h-3 w-3 border-b border-sky-600 mr-2"></div>
                                        Saving your note...
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <div
                                    className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                                      place.notes
                                        ? "bg-amber-50 border-amber-200 hover:bg-amber-100"
                                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                                    }`}
                                    onClick={() => handleEditNote(originalIndex, place.notes || "")}
                                  >
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm text-slate-700 italic flex-grow">
                                        {place.notes || "Click to add your notes, tips, or memories..."}
                                      </p>
                                      <FiEdit className="text-slate-400 ml-2 group-hover:text-sky-500 transition-colors" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <FaCompass className="text-4xl text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 italic">No places suggested for this day.</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50">
              <FaPlane className="text-6xl text-slate-300 mx-auto mb-6 transform rotate-12" />
              <h3 className="text-2xl font-bold text-slate-800 mb-4">No Places Yet</h3>
              <p className="text-slate-600">No suggested places for this trip yet.</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-12 bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 p-8">
          <div className="text-center">
            <h4 className="text-xl font-bold text-slate-800 mb-6">Share Your Adventure</h4>

            {emailMessage && (
              <div
                className={`p-4 rounded-xl text-center mb-6 font-medium ${
                  emailMessageType === "success"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {emailMessage}
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={handleSendEmailCopy}
                className="flex items-center justify-center px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none w-full sm:w-auto"
                disabled={sendingEmail || !trip || !user?.email}
              >
                {sendingEmail ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <FiMail className="mr-3" />
                    Email Trip Plan
                  </>
                )}
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="flex items-center justify-center px-8 py-4 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 w-full sm:w-auto"
              >
                <FaCompass className="mr-3" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
