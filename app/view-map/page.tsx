"use client"
export const dynamic = 'force-dynamic'

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"
import "leaflet/dist/leaflet.css"
import { FiMapPin, FiClock, FiGlobe, FiNavigation, FiArrowLeft, FiCalendar, FiTruck, FiMenu, FiX } from "react-icons/fi" // Added FiMenu and FiX
import { FaMap, FaPlane, FaCompass, FaLocationArrow } from "react-icons/fa"

// Dynamically import react-leaflet components to prevent SSR issues
import dynamic from "next/dynamic"

const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false })
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false })
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false })
const Polyline = dynamic(() => import("react-leaflet").then((mod) => mod.Polyline), { ssr: false })

import { useMap } from "react-leaflet"

// Define the structure of a SuggestedPlace (consistent with plan-trip-page)
interface SuggestedPlace {
  name: string
  description: string
  time_to_visit?: string
}

// Define the structure of a Trip item (consistent with plan-trip-page)
interface Trip {
  id: string
  user_id: string
  starting_point: string
  destination: string
  travel_date: string
  duration: number
  interests: string[]
  suggested_places: SuggestedPlace[]
  preferred_travel_mode?: string
  shortest_route_optimization?: boolean
  show_top_rated_places?: boolean
  avoid_crowded_places?: boolean
  send_email_copy?: boolean
}

// Define a type for coordinates [latitude, longitude]
type LatLngTuple = [number, number]

// Define a type for markers that react-leaflet's Marker component can use
interface MapMarker {
  position: LatLngTuple
  popupContent: string
}

// Component to fit map bounds to markers and route
interface FitBoundsToMarkersProps {
  markers: MapMarker[]
  routeCoordinates: LatLngTuple[]
  leafletLoaded: boolean
}

function FitBoundsToMarkers({ markers, routeCoordinates, leafletLoaded }: FitBoundsToMarkersProps) {
  const map = useMap()
  const dataHash = JSON.stringify({ markers, routeCoordinates })

  useEffect(() => {
    console.log(
      "FitBoundsToMarkers useEffect triggered. Map instance:",
      map,
      "Leaflet Loaded:",
      leafletLoaded,
      "Markers count:",
      markers.length,
      "Route coords count:",
      routeCoordinates.length,
    )

    if (!map || !leafletLoaded || (markers.length === 0 && routeCoordinates.length === 0)) {
      console.log("FitBoundsToMarkers: Skipping fitting bounds due to missing map, leaflet, or data.")
      return
    }

    if (typeof window === "undefined" || !window.L) {
      console.warn("Leaflet's global L object is not available yet in FitBoundsToMarkers.")
      return
    }

    const L = window.L
    const bounds = new L.LatLngBounds([])

    markers.forEach((marker) => {
      bounds.extend(marker.position)
    })

    routeCoordinates.forEach((coord) => {
      bounds.extend(coord)
    })

    if (bounds.isValid()) {
      console.log("FitBoundsToMarkers: Fitting map bounds.")
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
    } else {
      console.log("FitBoundsToMarkers: Calculated bounds are not valid, cannot fit map.")
    }
  }, [map, dataHash, leafletLoaded])

  return null
}

export default function ViewMapPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tripId = searchParams.get("tripId")

  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState<boolean>(true)
  const [trip, setTrip] = useState<Trip | null>(null)
  const [loadingTrip, setLoadingTrip] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [mapCenter, setMapCenter] = useState<LatLngTuple>([20.5937, 78.9629])
  const [markers, setMarkers] = useState<MapMarker[]>([])
  const [routeCoordinates, setRouteCoordinates] = useState<LatLngTuple[]>([])
  const [loadingMapData, setLoadingMapData] = useState<boolean>(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [leafletLoaded, setLeafletLoaded] = useState<boolean>(false)
  const [isClient, setIsClient] = useState<boolean>(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false) // State for mobile menu

  const orsApiKey = process.env.NEXT_PUBLIC_ORS_API_KEY

  // Authenticate user
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user } = {},
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

  // Dynamically import Leaflet and fix icon issue on client-side only
  useEffect(() => {
    setIsClient(true)
    if (typeof window !== "undefined") {
      import("leaflet").then((LModule) => {
        const L = LModule.default
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
        })
        setLeafletLoaded(true)
      })
    }
  }, [])

  // Fetch trip details
  useEffect(() => {
    const fetchTripDetails = async () => {
      if (!user) {
        setLoadingTrip(false)
        return
      }
      if (!tripId) {
        setTrip(null)
        setError("No trip selected. Please select a trip from your dashboard or a specific trip plan.")
        setLoadingTrip(false)
        return
      }

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
        } else if (tripData) {
          setTrip(tripData as Trip)
          setError(null)
        } else {
          setError("Trip not found or you do not have permission to view it.")
          setTrip(null)
        }
      } catch (err: any) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error("Error fetching trip details:", errMsg)
        setError(`Error fetching trip details: ${errMsg}.`)
      } finally {
        setLoadingTrip(false)
      }
    }

    if (!loadingUser) {
      fetchTripDetails()
    }
  }, [user, tripId, loadingUser])

  // Geocoding function using OpenStreetMap Nominatim
  const geocodeAddress = async (address: string): Promise<LatLngTuple | null> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      )
      if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(`Nominatim geocoding error: ${response.status} - ${errorBody}`)
      }
      const data = await response.json()
      if (data && data.length > 0) {
        return [Number.parseFloat(data[0].lat), Number.parseFloat(data[0].lon)]
      }
      console.warn(`Nominatim could not find precise coordinates for "${address}".`)
      return null
    } catch (err: any) {
      console.error(`Error geocoding address "${address}":`, err.message)
      setMapError((prev) =>
        prev
          ? `${prev}<br>Could not find location for "${address}". Try a more general name or verify spelling.`
          : `Could not find location for "${address}". Try a more general name or verify spelling.`,
      )
      return null
    }
  }

  // Helper function to map internal travel modes to ORS API profiles
  const getOrsProfile = (mode: string | undefined): string => {
    switch (mode) {
      case "car":
        return "driving-car"
      case "walk":
        return "walking"
      case "public_transport":
        return "driving-car" // OpenRouteService doesn't have a direct 'public_transport' profile. Using 'driving-car' as a fallback or you'd need a different routing service.
      default:
        return "driving-car"
    }
  }

  // Get directions from OpenRouteService
  const getDirections = async (coordinates: LatLngTuple[], profile: string): Promise<LatLngTuple[] | null> => {
    if (!orsApiKey) {
      console.error("ORS API Key is missing. Cannot get directions.")
      setMapError("Map directions are unavailable: ORS API Key is not configured.")
      return null
    }
    if (coordinates.length < 2) {
      return null
    }

    const orsCoordinates = coordinates.map((coord) => [coord[1], coord[0]])

    try {
      const response = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}`, {
        method: "POST",
        headers: {
          Accept: "application/json, application/geo+json, application/gpx+xml, application/x-protobuf",
          "Content-Type": "application/json",
          Authorization: orsApiKey,
        },
        body: JSON.stringify({
          coordinates: orsCoordinates,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.json()
        throw new Error(`ORS Directions error: ${response.status} - ${JSON.stringify(errorBody)}`)
      }

      const data = await response.json()

      if (
        data.routes &&
        data.routes.length > 0 &&
        data.routes[0].geometry &&
        Array.isArray(data.routes[0].geometry.coordinates) &&
        data.routes[0].geometry.coordinates.length > 0
      ) {
        return data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]])
      }

      console.warn("ORS response did not contain valid route geometry or it was empty:", data)
      return null
    } catch (err: any) {
      console.error("Error fetching ORS directions:", err.message)
      return null
    }
  }

  // Effect to add markers and draw route when trip data is loaded
  useEffect(() => {
    const addMarkersAndRoute = async () => {
      if (!trip || !leafletLoaded || !isClient) return

      setLoadingMapData(true)
      setMapError(null)

      const newMarkers: MapMarker[] = []
      let placeCoordinates: LatLngTuple[] = []

      // Geocode starting point if available
      if (trip.starting_point) {
        const startCoord = await geocodeAddress(trip.starting_point)
        if (startCoord) {
          placeCoordinates.push(startCoord)
          newMarkers.push({
            position: startCoord,
            popupContent: `<b>Starting Point:</b> ${trip.starting_point}`,
          })
        }
      }

      // Geocode destination
      const destCoord = await geocodeAddress(trip.destination)
      if (destCoord) {
        placeCoordinates.push(destCoord)
        newMarkers.push({
          position: destCoord,
          popupContent: `<b>Destination:</b> ${trip.destination}`,
        })
      } else {
        setMapError("Could not find coordinates for the main destination. Map cannot be displayed.")
        setLoadingMapData(false)
        return
      }

      // Geocode suggested places
      for (const place of trip.suggested_places) {
        const fullAddress = `${place.name}, ${trip.destination}` // Added destination to improve geocoding accuracy
        const coord = await geocodeAddress(fullAddress)
        if (coord) {
          placeCoordinates.push(coord)
          newMarkers.push({
            position: coord,
            popupContent: `<b>${place.name}</b><br>${place.description}`,
          })
        }
      }

      placeCoordinates = placeCoordinates.filter((coord): coord is LatLngTuple => coord !== null)

      setMarkers(newMarkers)

      if (placeCoordinates.length > 0) {
        // Set map center to the first coordinate or a more central point if desired
        setMapCenter(placeCoordinates[0])
      } else {
        setMapError((prev) =>
          prev
            ? `${prev}<br>No valid locations found to display on the map.`
            : `No valid locations found to display on the map.`,
        )
        setLoadingMapData(false)
        return
      }

      if (placeCoordinates.length >= 2) {
        const orsProfile = getOrsProfile(trip.preferred_travel_mode)
        const route = await getDirections(placeCoordinates, orsProfile)
        setRouteCoordinates(route || [])
      } else {
        setRouteCoordinates([])
      }

      setLoadingMapData(false)
    }

    if (trip && !loadingTrip && leafletLoaded && isClient) {
      addMarkersAndRoute()
    }
  }, [trip, loadingTrip, leafletLoaded, isClient])

  // Helper function for navigation
  const navigateTo = (path: string) => {
    setIsMobileMenuOpen(false); // Close menu on navigation
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

  if (loadingUser || loadingTrip || !isClient || !leafletLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-emerald-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4"></div>
          <p className="text-slate-600 text-lg font-medium">Loading your adventure map...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-orange-50">
        <div className="text-center bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50 max-w-md mx-4"> {/* Added mx-4 for horizontal margin on small screens */}
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiMapPin className="text-rose-500 text-2xl" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-4">Oops! Something went wrong</h3>
          <p className="text-rose-700 text-lg font-medium mb-6">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-6 py-3 bg-gradient-to-r from-sky-500 to-emerald-500 text-white rounded-lg hover:from-sky-600 hover:to-emerald-600 transition-all duration-200 font-medium shadow-sm"
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
        <div className="text-center bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50 max-w-md mx-4"> {/* Added mx-4 for horizontal margin on small screens */}
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaMap className="text-slate-500 text-2xl" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-4">No Trip Selected</h3>
          <p className="text-slate-700 text-lg font-medium mb-6">
            No trip selected or data available to display on map.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-6 py-3 bg-gradient-to-r from-sky-500 to-emerald-500 text-white rounded-lg hover:from-sky-600 hover:to-emerald-600 transition-all duration-200 font-medium shadow-sm"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-sky-100 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-emerald-400 rounded-xl flex items-center justify-center">
                <FaCompass className="text-white text-lg" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-sky-600 to-emerald-600 bg-clip-text text-transparent">
                Smart Travel Guide
              </h1>
            </div>

            {/* Mobile menu button */}
            {/* Adjusted div to include 'flex items-center' and button for better sizing and tap target */}
            <div className="md:hidden flex items-center">
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-lg transition-all duration-200 text-slate-600 hover:text-sky-600 focus:outline-none">
                {isMobileMenuOpen ? <FiX className="h-6 w-6" /> : <FiMenu className="h-6 w-6" />}
              </button>
            </div>

            {/* Desktop navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {[
                { label: "Dashboard", path: "/dashboard" },
                { label: "Plan Trip", path: "/plan-trip" },
              ].map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigateTo(item.path)}
                  className="px-3 py-1 sm:px-4 sm:py-2 text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all duration-200 font-medium text-sm sm:text-base"
                >
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => supabase.auth.signOut().then(() => router.push("/"))}
                className="ml-0 sm:ml-4 px-3 py-1 sm:px-4 sm:py-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-lg hover:from-rose-600 hover:to-pink-600 transition-all duration-200 font-medium shadow-sm text-sm sm:text-base"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu content */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white/90 backdrop-blur-md pb-4 pt-2 border-b border-sky-100 shadow-md">
            <div className="px-4 space-y-2">
              {[
                { label: "Dashboard", path: "/dashboard" },
                { label: "Plan Trip", path: "/plan-trip" },
              ].map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigateTo(item.path)}
                  className="block w-full text-left px-4 py-2 text-slate-700 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-all duration-200 font-medium"
                >
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => supabase.auth.signOut().then(() => router.push("/"))}
                className="block w-full text-left px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-md hover:from-rose-600 hover:to-pink-600 transition-all duration-200 font-medium shadow-sm"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8"> {/* Adjusted px-6 to px-4 sm:px-6 and py-8 to py-6 sm:py-8 */}
        {/* Header Section */}
        <div className="mb-6 sm:mb-8"> {/* Adjusted mb-8 to mb-6 sm:mb-8 */}
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center text-slate-600 hover:text-sky-600 font-medium mb-4 sm:mb-6 transition-colors duration-200 group text-sm sm:text-base" // Adjusted mb-6 to mb-4 sm:mb-6 and text size
          >
            <FiArrowLeft className="mr-2 group-hover:-translate-x-1 transition-transform duration-200" />
            Back to Dashboard
          </button>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 p-6 sm:p-8 mb-6 sm:mb-8"> {/* Adjusted p-8 to p-6 sm:p-8 and mb-8 to mb-6 sm:mb-8 */}
            <div className="flex flex-col sm:flex-row items-center sm:justify-between mb-4 sm:mb-6 text-center sm:text-left"> {/* Added flex-col sm:flex-row, items-center, text-center sm:text-left */}
              <div className="mb-4 sm:mb-0"> {/* Added mb-4 sm:mb-0 */}
                <h2 className="text-2xl sm:text-4xl font-bold text-slate-800 mb-2 sm:mb-4 flex items-center justify-center sm:justify-start"> {/* Adjusted text size for mobile and added justify-center */}
                  <FiNavigation className="text-sky-500 mr-2 sm:mr-3 text-xl sm:text-auto" /> {/* Adjusted margin and text size */}
                  Interactive Map
                </h2>
                <div className="flex items-center justify-center sm:justify-start space-x-2 text-slate-600"> {/* Added justify-center sm:justify-start */}
                  <FiMapPin className="text-emerald-500 text-lg sm:text-xl" /> {/* Adjusted text size */}
                  <span className="text-lg sm:text-xl font-semibold">{trip.destination}</span> {/* Adjusted text size */}
                </div>
              </div>
              <div className="text-center sm:text-right"> {/* Added text-center sm:text-right */}
                <div className="bg-gradient-to-r from-sky-50 to-emerald-50 rounded-xl p-3 sm:p-4 border border-sky-100"> {/* Adjusted padding */}
                  <div className="text-xl sm:text-2xl font-bold text-slate-800">{trip.suggested_places.length}</div> {/* Adjusted text size */}
                  <div className="text-xs sm:text-sm text-slate-600">Places to Visit</div> {/* Adjusted text size */}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4"> {/* Adjusted gap */}
              <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-sky-50 to-emerald-50 rounded-xl">
                <FiCalendar className="text-sky-500 text-lg sm:text-xl" /> {/* Adjusted text size */}
                <div>
                  <div className="text-xs sm:text-sm text-slate-600">Travel Date</div> {/* Adjusted text size */}
                  <div className="font-semibold text-slate-800 text-sm sm:text-base">{formatDate(trip.travel_date)}</div> {/* Adjusted text size */}
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-emerald-50 to-sky-50 rounded-xl">
                <FiClock className="text-emerald-500 text-lg sm:text-xl" /> {/* Adjusted text size */}
                <div>
                  <div className="text-xs sm:text-sm text-slate-600">Duration</div> {/* Adjusted text size */}
                  <div className="font-semibold text-slate-800 text-sm sm:text-base">
                    {trip.duration} day{trip.duration !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl">
                <FiTruck className="text-amber-500 text-lg sm:text-xl" /> {/* Adjusted text size */}
                <div>
                  <div className="text-xs sm:text-sm text-slate-600">Travel Mode</div> {/* Adjusted text size */}
                  <div className="font-semibold text-slate-800 text-sm sm:text-base">
                    {trip.preferred_travel_mode?.replace("_", " ") || "Not specified"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Map Error Display */}
        {mapError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl mb-6 text-center text-sm sm:text-base"> {/* Adjusted text size */}
            <div className="flex items-center justify-center mb-2">
              <FiMapPin className="text-rose-500 mr-2 text-lg sm:text-xl" /> {/* Adjusted text size */}
              <span className="font-medium">Map Loading Issue</span>
            </div>
            <div dangerouslySetInnerHTML={{ __html: mapError }}></div>
          </div>
        )}

        {/* Loading Indicator */}
        {loadingMapData && (
          <div className="flex items-center justify-center p-4 sm:p-6 bg-sky-50 rounded-xl mb-6 border border-sky-200 text-sm sm:text-base"> {/* Adjusted padding and text size */}
            <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-sky-500 mr-3"></div> {/* Adjusted size */}
            <span className="text-sky-700 font-medium">Loading map and route... This might take a moment.</span>
          </div>
        )}

        {/* Map Container */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 p-4 sm:p-6 mb-6 sm:mb-8"> {/* Adjusted padding and mb */}
          <div className="h-[400px] sm:h-[500px] md:h-[600px] w-full relative rounded-xl overflow-hidden"> {/* Made height responsive */}
            {isClient && leafletLoaded && !loadingUser && !loadingTrip && trip ? (
              <MapContainer
                key={`${trip.id}-${isClient}-${leafletLoaded}`}
                center={mapCenter}
                zoom={10}
                scrollWheelZoom={true}
                className="h-full w-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {markers.map((marker, idx) => (
                  <Marker key={idx} position={marker.position}>
                    <Popup>{marker.popupContent}</Popup>
                  </Marker>
                ))}
                {routeCoordinates.length > 0 && (
                  <Polyline positions={routeCoordinates} color="#0ea5e9" weight={4} opacity={0.8} />
                )}
                <FitBoundsToMarkers
                  markers={markers}
                  routeCoordinates={routeCoordinates}
                  leafletLoaded={leafletLoaded}
                />
              </MapContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-sky-50 rounded-xl">
                <div className="text-center">
                  <FaCompass className="text-3xl sm:text-4xl text-slate-400 mx-auto mb-3 sm:mb-4 animate-spin" /> {/* Adjusted size and mb */}
                  <p className="text-slate-600 font-medium text-sm sm:text-base">Initializing map...</p> {/* Adjusted text size */}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Trip Places List */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 p-6 sm:p-8 mb-6 sm:mb-8"> {/* Adjusted padding and mb */}
          <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-4 sm:mb-6 flex items-center justify-center sm:justify-start"> {/* Adjusted text size and added justify-center */}
            <FaLocationArrow className="text-emerald-500 mr-2 sm:mr-3 text-lg sm:text-auto" /> {/* Adjusted margin and size */}
            Places on Your Route
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"> {/* Adjusted gap */}
            {trip.starting_point && (
              <div className="p-3 sm:p-4 bg-gradient-to-r from-sky-50 to-emerald-50 rounded-xl border border-sky-100"> {/* Adjusted padding */}
                <div className="flex items-center mb-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-sky-500 rounded-full flex items-center justify-center mr-2 sm:mr-3"> {/* Adjusted size and margin */}
                    <FaPlane className="text-white text-xs sm:text-sm" /> {/* Adjusted text size */}
                  </div>
                  <h4 className="font-semibold text-slate-800 text-sm sm:text-base">Starting Point</h4> {/* Adjusted text size */}
                </div>
                <p className="text-slate-600 text-xs sm:text-sm">{trip.starting_point}</p> {/* Adjusted text size */}
              </div>
            )}
            {trip.suggested_places.map((place, index) => (
              <div
                key={index}
                className="p-3 sm:p-4 bg-gradient-to-r from-emerald-50 to-sky-50 rounded-xl border border-emerald-100"
              > {/* Adjusted padding */}
                <div className="flex items-center mb-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-emerald-500 rounded-full flex items-center justify-center mr-2 sm:mr-3"> {/* Adjusted size and margin */}
                    <span className="text-white text-xs sm:text-sm font-bold">{index + 1}</span> {/* Adjusted text size */}
                  </div>
                  <h4 className="font-semibold text-slate-800 text-sm sm:text-base">{place.name}</h4> {/* Adjusted text size */}
                </div>
                <p className="text-slate-600 text-xs sm:text-sm mb-2">{place.description}</p> {/* Adjusted text size */}
                {place.time_to_visit && (
                  <div className="flex items-center text-xs text-slate-500">
                    <FiClock className="mr-1" />
                    <span>{place.time_to_visit}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="text-center">
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4"> {/* Adjusted gap and added flex-col sm:flex-row */}
            <button
              onClick={() => router.push(`/trip/${tripId}`)}
              className="flex items-center justify-center px-6 py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 text-sm sm:text-base" // Adjusted padding and text size
            >
              <FiGlobe className="mr-2 sm:mr-3" /> {/* Adjusted margin */}
              View Detailed Plan
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center justify-center px-6 py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white font-semibold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 text-sm sm:text-base" // Adjusted padding and text size
            >
              <FaCompass className="mr-2 sm:mr-3" /> {/* Adjusted margin */}
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}