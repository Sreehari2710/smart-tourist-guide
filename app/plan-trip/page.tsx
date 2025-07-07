// app/plan-trip/page.tsx
// This file now acts as a wrapper for the main trip planning logic,
// using Suspense to ensure client-side hooks like useSearchParams are
// only executed in the browser environment.

'use client'; // This directive applies to the entire file, making it a client component.

export const dynamic = 'force-dynamic'; // Added to ensure dynamic rendering and prevent SSR issues

import type React from "react"
import { useState, useEffect, useRef, useCallback, Suspense } from "react" // Added Suspense
import { useRouter, useSearchParams } from "next/navigation" // Import useSearchParams hook
import { supabase } from "@/lib/supabase" // Import Supabase client
import type { User } from "@supabase/supabase-js" // Import User type
import {
  FiMapPin, // For Destination City input icon
  FiCalendar, // For Travel Date input icon
  FiClock, // For Duration input icon
  FiCoffee, // For Cafes interest
  FiShoppingCart, // For Shopping interest
  FiGlobe, // For Current Location/GPS / Starting Point
  FiMail, // For Email Itinerary
  FiTarget, // For Shortest Route Optimization
  FiStar, // For Top-rated places
  FiUsers, // For Avoid crowded places (as in many many people)
  FiSend, // For chat send button
  FiMessageSquare, // For chat icon
  FiRefreshCcw, // For regenerate button
  FiCompass,
  FiMap, // For map icon
  FiNavigation, // For navigation icon
  FiZap, // For quick suggestions
  FiMenu, // For hamburger icon
  FiX, // For close icon
} from "react-icons/fi"
import {
  FaLandmark, // For Temples, Historical Places
  FaWater, // For Water Parks
  FaTree, // For Nature/Parks
  FaSpa, // For Wellness/Spas
  FaPaintBrush, // For Art & Museums
  FaUtensils, // For Food & Local Cuisine
  FaWalking, // For walk mode
  FaCar, // For car mode
  FaBus, // For public transport mode
} from "react-icons/fa"

// Define the structure of a SuggestedPlace (AI's output)
interface SuggestedPlace {
  name: string
  description: string
  time_to_visit?: string // NEW: Estimated time to visit this place
}

// Define the structure of a Trip item (for Supabase)
interface Trip {
  id: string
  user_id: string
  starting_point: string // NEW: Starting point of the trip
  destination: string
  travel_date: string
  duration: number
  interests: string[] // Array of interest IDs
  suggested_places: SuggestedPlace[] // JSONB column
  preferred_travel_mode?: string
  shortest_route_optimization?: boolean
  show_top_rated_places?: boolean
  avoid_crowded_places?: boolean
  send_email_copy?: boolean
}

// Define the shape of an interest item for UI display
interface Interest {
  id: string
  name: string
  icon: React.ElementType // Type for React Icon component
}

// Define available interests with their icons
const availableInterests: Interest[] = [
  { id: "historical_places", name: "Historical Places", icon: FaLandmark },
  { id: "temples", name: "Temples", icon: FaLandmark },
  { id: "adventure_parks", name: "Adventure Parks", icon: FaWater }, // Using FaWater for water parks, FaFlag for general adventure
  { id: "cafes", name: "Cafes", icon: FiCoffee },
  { id: "shopping", name: "Shopping", icon: FiShoppingCart },
  { id: "nature_parks", name: "Nature/Parks", icon: FaTree },
  { id: "wellness_spas", name: "Wellness/Spas", icon: FaSpa },
  { id: "art_museums", name: "Art & Museums", icon: FaPaintBrush },
  { id: "food_local_cuisine", name: "Food & Local Cuisine", icon: FaUtensils },
]

// Inner component that contains all the actual page logic and uses useSearchParams
function InnerPlanTripPage() {
  const router = useRouter()
  const searchParams = useSearchParams() // useSearchParams is now safely inside this component

  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState<boolean>(true)

  // Form states
  const [startingPoint, setStartingPoint] = useState<string>("") // NEW: Starting Point
  const [destination, setDestination] = useState<string>("")
  const [travelDate, setTravelDate] = useState<string>("")
  const [duration, setDuration] = useState<number | "">(1)
  const [interests, setInterests] = useState<string[]>([])
  const [preferredTravelMode, setPreferredTravelMode] = useState<string>("car") // 'car', 'walk', 'public_transport'
  const [shortestRouteOptimization, setShortestRouteOptimization] = useState<boolean>(true)
  const [showTopRatedPlaces, setShowTopRatedPlaces] = useState<boolean>(true)
  const [avoidCrowdedPlaces, setAvoidCrowdedPlaces] = useState<boolean>(false)
  const [sendEmailCopy, setSendEmailCopy] = useState<boolean>(true)

  // UI states
  const [loadingPlan, setLoadingPlan] = useState<boolean>(false)
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [formMessageType, setFormMessageType] = useState<"success" | "error" | null>(null)
  const [suggestedPlaces, setSuggestedPlaces] = useState<SuggestedPlace[]>([])
  const [currentTripId, setCurrentTripId] = useState<string | null>(null) // To store the ID of the newly created trip
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false) // NEW: State for mobile menu

  // Autocomplete states for Start Point and Destination
  const [startingPointInput, setStartingPointInput] = useState<string>("")
  const [destinationInput, setDestinationInput] = useState<string>("")
  const [startingPointSuggestions, setStartingPointSuggestions] = useState<string[]>([])
  const [destinationSuggestions, setDestinationSuggestions] = useState<string[]>([])
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null)

  // Advanced AI Interaction (Conversational Planning) states
  const [showChat, setShowChat] = useState<boolean>(false)
  const [chatHistory, setChatHistory] = useState<{ role: string; parts: { text: string }[] }[]>([])
  const [chatInput, setChatInput] = useState<string>("")
  const [chatLoading, setChatLoading] = useState<boolean>(false)
  const chatContainerRef = useRef<HTMLDivElement>(null) // Ref to scroll chat to bottom

  // Quick suggestion states
  const [quickSuggestions] = useState<string[]>([
    "Add more historical sites",
    "Include local restaurants",
    "Suggest budget-friendly options",
    "Add adventure activities",
    "Include shopping areas",
    "Recommend photo spots",
  ])

  // Authenticate user
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user } = { user: null },
      } = await supabase.auth.getUser() // Destructure with default value
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

  // Handle re-planning: Load existing trip data if replanTripId is present
  useEffect(() => {
    const loadTripForReplan = async () => {
      // Access replanTripId inside useEffect to ensure searchParams is available
      const currentReplanTripId = searchParams ? searchParams.get("replanTripId") : null
      if (currentReplanTripId && user) {
        setLoadingPlan(true)
        try {
          const { data, error } = await supabase
            .from("trips")
            .select("*")
            .eq("id", currentReplanTripId)
            .eq("user_id", user.id)
            .single()

          if (error) {
            console.error("Error loading trip for re-plan:", error.message)
            setFormMessage("Failed to load previous trip data for re-planning.")
            setFormMessageType("error")
          } else if (data) {
            setStartingPoint(data.starting_point || "")
            setStartingPointInput(data.starting_point || "")
            setDestination(data.destination)
            setDestinationInput(data.destination)
            setTravelDate(data.travel_date)
            setDuration(data.duration)
            setInterests(data.interests || [])
            setPreferredTravelMode(data.preferred_travel_mode || "car")
            setShortestRouteOptimization(data.shortest_route_optimization ?? true)
            setShowTopRatedPlaces(data.show_top_rated_places ?? true)
            setAvoidCrowdedPlaces(data.avoid_crowded_places ?? false)
            setSendEmailCopy(data.send_email_copy ?? true)
            setSuggestedPlaces(data.suggested_places || [])
            setCurrentTripId(data.id) // Set current trip ID for potential updates
            setFormMessage("Previous trip data loaded for re-planning!")
            setFormMessageType("success")
          }
        } finally {
          setLoadingPlan(false)
        }
      }
    }

    if (user && !loadingUser && searchParams) {
      // Add searchParams to dependency array
      loadTripForReplan()
    }
  }, [user, loadingUser, searchParams]) // Re-fetch if user, loadingUser, or searchParams changes

  // OpenStreetMap Nominatim API for place suggestions (international)
  const fetchPlaceSuggestions = useCallback(
    async (input: string, setSuggestions: React.Dispatch<React.SetStateAction<string[]>>) => {
      if (!input || input.length < 3) {
        // Require at least 3 characters for suggestions
        setSuggestions([])
        return
      }

      if (typingTimeout) {
        clearTimeout(typingTimeout)
      }

      setTypingTimeout(
        setTimeout(async () => {
          try {
            // Using Nominatim's public endpoint. Be mindful of their usage policy.
            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input)}&limit=5&addressdetails=1`,
            )
            const data = await response.json()
            if (data && data.length > 0) {
              setSuggestions(data.map((p: unknown) => (p as { display_name: string }).display_name))
            } else {
              setSuggestions([])
            }
          } catch (error) {
            console.error("Error fetching place suggestions from Nominatim:", error)
            setSuggestions([])
          }
        }, 300),
      ) // Debounce time
    },
    [typingTimeout],
  )

  /**
   * Calls the Gemini API for trip suggestions or refinement.
   * This function now takes chat history into account for conversational flow.
   * @param currentPrompt - The user's latest input or initial prompt.
   * @param fullChatHistory - The array of previous messages (user and model).
   * @param currentTripDetails - Current trip details for context.
   * @returns A promise that resolves with an array of suggested places or null.
   */
  const getGeminiSuggestions = async (
    currentPrompt: string,
    fullChatHistory: { role: string; parts: { text: string }[] }[],
    currentTripDetails: {
      startingPoint: string
      destination: string
      duration: number | ""
      interests: string[]
      preferredTravelMode: string
      shortestRouteOptimization: boolean
      showTopRatedPlaces: boolean
      avoidCrowdedPlaces: boolean
      sendEmailCopy: boolean
      suggestedPlaces: SuggestedPlace[] // Current suggestions to refine
    },
  ): Promise<SuggestedPlace[] | null> => {
    // Convert interest IDs to human-readable names for the prompt
    const interestNames = currentTripDetails.interests
      .map((id) => availableInterests.find((i) => i.id === id)?.name)
      .filter(Boolean)
      .join(", ")

    // Adjusted prompt for clarity and to enforce flat structure
    const basePrompt = `
      You are an AI trip planner. Generate a list of suggested places to visit.
      Based on the following trip details:
      Starting Point: ${currentTripDetails.startingPoint || "Not specified"}
      Destination: ${currentTripDetails.destination}
      Duration: ${currentTripDetails.duration} days
      Interests: ${interestNames}
      Preferred Travel Mode: ${currentTripDetails.preferredTravelMode.replace("_", " ")}
      Shortest Route Optimization: ${currentTripDetails.shortestRouteOptimization ? "Yes" : "No"}
      Show Top-Rated Places: ${currentTripDetails.showTopRatedPlaces ? "Yes" : "No"}
      Avoid Crowded Places: ${currentTripDetails.avoidCrowdedPlaces ? "Yes" : "No"}
      Current Suggested Places (for refinement): ${currentTripDetails.suggestedPlaces.map((p) => p.name).join(", ") || "None yet"}.

      The user's latest request is: "${currentPrompt}".

      Provide the output as a JSON array of objects. Each object must have 'name' (string), 'description' (string), and 'time_to_visit' (string, e.g., '2 hours', 'Half day').
      Do NOT include daily breakdowns or nested structures. Just a flat list of places.

      Example:
      [
        {"name": "Eiffel Tower", "description": "Iconic landmark in Paris.", "time_to_visit": "2-3 hours"},
        {"name": "Louvre Museum", "description": "World's largest art museum.", "time_to_visit": "Half day (4-5 hours)"}
      ]

      Ensure the JSON is valid and only contains the array. If no suitable places are found, return an empty array [].
    `

    // Construct chat history for Gemini API
    const geminiChatHistory = fullChatHistory.map((msg) => ({
      role: msg.role,
      parts: msg.parts,
    }))

    // Add the base prompt as the last user message to guide the model
    geminiChatHistory.push({ role: "user", parts: [{ text: basePrompt }] })

    try {
      const payload = {
        contents: geminiChatHistory,
        generationConfig: {
          responseMimeType: "application/json", // Request JSON output
          responseSchema: {
            // Define the schema for the expected JSON array
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                description: { type: "STRING" },
                time_to_visit: { type: "STRING" }, // Added time_to_visit to schema
              },
              propertyOrdering: ["name", "description", "time_to_visit"], // Maintain order of properties
            },
          },
        },
      }

      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""
      if (!apiKey) {
        throw new Error("Gemini API Key is not set. Please add NEXT_PUBLIC_GEMINI_API_KEY to your .env.local file.")
      }

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("Gemini API error response:", errorData)
        if (response.status === 503) {
          throw new Error("The AI service is currently overloaded. Please try again in a moment.")
        }
        throw new Error(
          `Gemini API request failed: ${response.status} ${response.statusText || JSON.stringify(errorData)}`,
        )
      }

      const result = await response.json()
      if (
        result.candidates &&
        result.candidates.length > 0 &&
        result.candidates[0].content &&
        result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0
      ) {
        const jsonString = result.candidates[0].content.parts[0].text
        try {
          const parsedJson: SuggestedPlace[] = JSON.parse(jsonString)
          // Validate the parsed JSON against the expected structure
          if (
            Array.isArray(parsedJson) &&
            parsedJson.every(
              (item) =>
                typeof item === "object" &&
                item !== null &&
                "name" in item &&
                typeof item.name === "string" &&
                "description" in item &&
                typeof item.description === "string" &&
                "time_to_visit" in item &&
                typeof item.time_to_visit === "string", // Ensure time_to_visit is present and string
            )
          ) {
            return parsedJson
          } else {
            console.error("Gemini API returned malformed JSON for suggested_places:", parsedJson)
            throw new Error(
              "AI generated an unparseable plan. Expected array of objects with name, description, and time_to_visit.",
            )
          }
        } catch (jsonError: unknown) {
          console.error("Error parsing Gemini API JSON response:", jsonError, jsonString)
          throw new Error(`Failed to parse Gemini API response. Raw: ${(jsonError as Error).message}`)
        }
      } else {
        console.error("Gemini API response structure unexpected:", result)
        throw new Error("Gemini API returned no content or unexpected structure.")
      }
    } catch (error: unknown) {
      console.error("Error fetching from Gemini API:", error)
      throw error // Re-throw to be caught by calling function
    }
  }

  // Handle form submission to generate and save the trip plan
  const handleGeneratePlan = async (e?: React.FormEvent) => {
    e?.preventDefault() // Use optional chaining here
    setLoadingPlan(true)
    setFormMessage(null)
    setSuggestedPlaces([]) // Clear previous suggestions
    setChatHistory([]) // Clear chat history

    if (!user) {
      setFormMessage("You must be logged in to plan a trip.")
      setFormMessageType("error")
      setLoadingPlan(false)
      return
    }

    if (!startingPoint || !destination || !travelDate || !duration) {
      setFormMessage("Please fill in all required trip details.")
      setFormMessageType("error")
      setLoadingPlan(false)
      return
    }

    if (interests.length === 0) {
      setFormMessage("Please select at least one interest.")
      setFormMessageType("error")
      setLoadingPlan(false)
      return
    }

    try {
      // Construct the detailed prompt for Gemini API
      const prompt = `
        Generate a list of suggested places to visit for a trip starting from "${startingPoint}" to "${destination}".
        The trip duration is ${duration} days.
        The user is interested in: ${interests.join(", ")}.
        Preferred travel mode: ${preferredTravelMode}.
        ${shortestRouteOptimization ? "Optimize the route for shortest distance." : "Do not prioritize shortest route."}
        ${showTopRatedPlaces ? "Prioritize top-rated places." : "Do not prioritize top-rated places."}
        ${avoidCrowdedPlaces ? "Avoid overly crowded places." : "Do not specifically avoid crowded places."}

        For each suggested place, include its 'name', 'description', and an estimated 'time_to_visit' in a human-readable format (e.g., '2 hours', '45 minutes', 'Full day').
        Provide the output as a JSON array of objects. Do NOT include daily breakdowns or nested structures. Just a flat list of places.

        Example format for a suggested place:
        [
          {
            "name": "Eiffel Tower",
            "description": "Iconic iron lattice tower in Paris, a global cultural icon.",
            "time_to_visit": "2-3 hours"
          },
          {
            "name": "Louvre Museum",
            "description": "World's largest art museum and a historic monument in Paris.",
            "time_to_visit": "Half day (4-5 hours)"
          }
        ]
      `

      setFormMessage("Generating your personalized trip plan with AI...")
      setFormMessageType("success")

      const initialSuggestedPlaces = await getGeminiSuggestions(
        prompt,
        [], // No prior chat history for initial call
        {
          startingPoint,
          destination,
          duration,
          interests,
          preferredTravelMode,
          shortestRouteOptimization,
          showTopRatedPlaces,
          avoidCrowdedPlaces,
          sendEmailCopy,
          suggestedPlaces: [], // No current suggestions yet
        },
      )

      if (!initialSuggestedPlaces) {
        // Error message would have been set by getGeminiSuggestions
        setLoadingPlan(false)
        return
      }

      setSuggestedPlaces(initialSuggestedPlaces)
      setFormMessage("Trip plan generated successfully!")
      setFormMessageType("success")

      // Save the trip to Supabase
      const { data: newTrip, error: supabaseError } = await supabase
        .from("trips")
        .insert({
          user_id: user.id,
          starting_point: startingPoint, // Save starting point
          destination,
          travel_date: travelDate,
          duration,
          interests,
          suggested_places: initialSuggestedPlaces, // Save the AI-generated places
          preferred_travel_mode: preferredTravelMode,
          shortest_route_optimization: shortestRouteOptimization,
          show_top_rated_places: showTopRatedPlaces,
          avoid_crowded_places: avoidCrowdedPlaces,
          send_email_copy: sendEmailCopy,
        })
        .select()
        .single()

      if (supabaseError) {
        throw new Error(`Supabase error saving trip: ${supabaseError.message}`)
      }

      setCurrentTripId(newTrip.id) // Store the ID of the new trip
      setFormMessage("Trip plan saved successfully!")
      setFormMessageType("success")

      // Initialize chat history with the initial prompt and response
      setChatHistory([
        { role: "user", parts: [{ text: prompt }] },
        { role: "model", parts: [{ text: JSON.stringify(initialSuggestedPlaces, null, 2) }] }, // Store the actual JSON response
      ])

      setShowChat(true) // Show chat after initial plan generation
    } catch (error: unknown) {
      console.error("Error generating or saving trip plan:", error)
      setFormMessage(`Error: ${(error as Error).message}`)
      setFormMessageType("error")
    } finally {
      setLoadingPlan(false)
    }
  }

  // Handle conversational AI chat submission
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || chatLoading || !currentTripId) return

    setChatLoading(true)
    const userMessage: { role: string; parts: { text: string }[] } = { role: "user", parts: [{ text: chatInput }] }
    const newChatHistory = [...chatHistory, userMessage]
    setChatHistory(newChatHistory)
    setChatInput("") // Clear input immediately

    try {
      // Fetch the latest trip data from Supabase to ensure AI has context
      const { data: latestTrip, error: fetchError } = await supabase
        .from("trips")
        .select(
          "destination, travel_date, duration, interests, suggested_places, preferred_travel_mode, starting_point, shortest_route_optimization, show_top_rated_places, avoid_crowded_places, send_email_copy",
        ) // Include all relevant fields
        .eq("id", currentTripId)
        .single()

      if (fetchError || !latestTrip) {
        throw new Error("Failed to fetch latest trip context for chat.")
      }

      const refinedSuggestions = await getGeminiSuggestions(
        userMessage.parts[0].text, // The user's latest message
        newChatHistory, // Pass the full chat history for context
        {
          startingPoint: latestTrip.starting_point || "",
          destination: latestTrip.destination,
          duration: latestTrip.duration,
          interests: latestTrip.interests,
          preferredTravelMode: latestTrip.preferred_travel_mode || "car",
          shortestRouteOptimization: latestTrip.shortest_route_optimization ?? true,
          showTopRatedPlaces: latestTrip.show_top_rated_places ?? true,
          avoidCrowdedPlaces: latestTrip.avoid_crowded_places ?? false,
          sendEmailCopy: latestTrip.send_email_copy ?? true,
          suggestedPlaces: latestTrip.suggested_places || [], // Pass current suggestions for refinement
        },
      )

      if (refinedSuggestions) {
        // Update the trip record in Supabase with refined suggestions
        const { error: updateError } = await supabase
          .from("trips")
          .update({ suggested_places: refinedSuggestions })
          .eq("id", currentTripId)

        if (updateError) {
          console.error("Error updating trip with refined Gemini suggestions:", updateError)
          setChatHistory((prev) => [
            ...prev,
            { role: "model", parts: [{ text: `Failed to save refined suggestions: ${updateError.message}` }] },
          ])
        } else {
          setSuggestedPlaces(refinedSuggestions) // Update UI with new suggestions
          setChatHistory((prev) => [
            ...prev,
            {
              role: "model",
              parts: [
                {
                  text: `Okay, I&apos;ve refined the plan. Please check the updated "Current Itinerary" above. What else would you like to change?`,
                },
              ],
            },
          ])
        }
      } else {
        // If new suggestions are null, it means an error occurred in getGeminiSuggestions
        setChatHistory((prev) => [
          ...prev,
          { role: "model", parts: [{ text: "I could not generate new suggestions based on your request. Please try rephrasing." }] },
        ])
      }
    } catch (error: unknown) {
      console.error("Error during conversational planning:", error)
      setChatHistory((prev) => [
        ...prev,
        { role: "model", parts: [{ text: `An error occurred: ${(error as Error).message}. Please try again.` }] },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatHistory])

  // Handle interest checkbox changes
  const handleInterestChange = (interestId: string) => {
    setInterests((prevInterests) =>
      prevInterests.includes(interestId)
        ? prevInterests.filter((id) => id !== interestId)
        : [...prevInterests, interestId],
    )
  }

  // Helper function for navigation in the top bar
  const navigateTo = (path: string) => {
    router.push(path)
    setIsMobileMenuOpen(false) // Close menu on navigation
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50 text-slate-800">
      {/* Top Navigation Bar */}
      <nav
        className="backdrop-blur-md border-b shadow-sm sticky top-0 z-50 transition-colors duration-300 bg-white/80 border-sky-100"
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-emerald-400 rounded-xl flex items-center justify-center">
                <FiCompass className="text-white text-lg" />
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
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg transition-all duration-200 text-slate-600"
              >
                {isMobileMenuOpen ? <FiX className="h-7 w-7" /> : <FiMenu className="h-7 w-7" />}
              </button>
            </div>
          </div>
        </div>
        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
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
                    setIsMobileMenuOpen(false)
                  }}
                  className="w-full text-center px-4 py-2 rounded-lg transition-all duration-200 font-medium text-slate-700 hover:text-sky-700 hover:bg-sky-50"
                >
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => {
                  handleLogout()
                  setIsMobileMenuOpen(false)
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
      <div className="max-w-7xl mx-auto p-6 pt-8">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-slate-800 mb-3">Plan Your Perfect Journey</h2>
          <p className="text-xl text-slate-600">Let AI create a personalized itinerary just for you</p>
        </div>
        <div className="backdrop-blur-sm rounded-3xl shadow-xl border bg-white/70 border-white/50 p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Trip Details Form */}
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Trip Details</h3>
              <p className="text-slate-600">Tell us about your dream destination</p>
            </div>

            <form onSubmit={handleGeneratePlan} className="space-y-6">
              {/* Start Point */}
              <div className="relative">
                <label
                  htmlFor="startingPoint"
                  className="block text-sm font-semibold text-slate-700 mb-2 flex items-center"
                >
                  <FiGlobe className="inline-block mr-2 text-sky-500" /> Starting Point
                </label>
                <input
                  type="text"
                  id="startingPoint"
                  className="w-full p-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent text-slate-700 transition-all duration-200 bg-white/70 backdrop-blur-sm hover:bg-white/90"
                  placeholder="e.g., Your current city, home address"
                  value={startingPointInput}
                  onChange={(e) => {
                    setStartingPointInput(e.target.value)
                    setStartingPoint(e.target.value) // Update actual value
                    fetchPlaceSuggestions(e.target.value, setStartingPointSuggestions)
                  }}
                  required
                />
                {startingPointSuggestions.length > 0 && startingPointInput.length >= 3 && (
                  <ul className="absolute z-10 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 w-full max-h-40 overflow-y-auto">
                    {startingPointSuggestions.map((suggestion, index) => (
                      <li
                        key={index}
                        className="p-3 cursor-pointer hover:bg-sky-50 transition-colors duration-200 text-sm"
                        onClick={() => {
                          setStartingPoint(suggestion)
                          setStartingPointInput(suggestion)
                          setStartingPointSuggestions([])
                        }}
                      >
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Travel Destination */}
              <div className="relative">
                <label
                  htmlFor="destination"
                  className="block text-sm font-semibold text-slate-700 mb-2 flex items-center"
                >
                  <FiMapPin className="inline-block mr-2 text-emerald-500" /> Travel Destination
                </label>
                <input
                  type="text"
                  id="destination"
                  className="w-full p-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-slate-700 transition-all duration-200 bg-white/70 backdrop-blur-sm hover:bg-white/90"
                  placeholder="e.g., Paris, Tokyo, New Delhi"
                  value={destinationInput}
                  onChange={(e) => {
                    setDestinationInput(e.target.value)
                    setDestination(e.target.value) // Update actual value
                    fetchPlaceSuggestions(e.target.value, setDestinationSuggestions)
                  }}
                  required
                />
                {destinationSuggestions.length > 0 && destinationInput.length >= 3 && (
                  <ul className="absolute z-10 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 w-full max-h-40 overflow-y-auto">
                    {destinationSuggestions.map((suggestion, index) => (
                      <li
                        key={index}
                        className="p-3 cursor-pointer hover:bg-emerald-50 transition-colors duration-200 text-sm"
                        onClick={() => {
                          setDestination(suggestion)
                          setDestinationInput(suggestion)
                          setDestinationSuggestions([])
                        }}
                      >
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Travel Dates & Duration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="travelDate"
                    className="block text-sm font-semibold text-slate-700 mb-2 flex items-center"
                  >
                    <FiCalendar className="inline-block mr-2 text-amber-500" /> Travel Date
                  </label>
                  <input
                    type="date"
                    id="travelDate"
                    className="w-full p-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-slate-700 transition-all duration-200 bg-white/70 backdrop-blur-sm hover:bg-white/90"
                    value={travelDate}
                    onChange={(e) => setTravelDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="duration"
                    className="block text-sm font-semibold text-slate-700 mb-2 flex items-center"
                  >
                    <FiClock className="inline-block mr-2 text-sky-500" /> Duration (days)
                  </label>
                  <input
                    type="number"
                    id="duration"
                    className="w-full p-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent text-slate-700 transition-all duration-200 bg-white/70 backdrop-blur-sm hover:bg-white/90"
                    placeholder="e.g., 3"
                    min="1"
                    value={duration}
                    onChange={(e) => setDuration(Number.parseInt(e.target.value) || "")}
                    required
                  />
                </div>
              </div>

              {/* What would you like to explore? */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  What would you like to explore?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {availableInterests.map((interest) => (
                    <label
                      key={interest.id}
                      className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                        interests.includes(interest.id)
                          ? "border-sky-400 bg-sky-50 text-sky-700"
                          : "border-slate-200 bg-white/50 hover:border-sky-300 hover:bg-sky-50/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        id={interest.id}
                        checked={interests.includes(interest.id)}
                        onChange={() => handleInterestChange(interest.id)}
                        className="sr-only"
                      />
                      <interest.icon className="mr-2 text-lg" />
                      <span className="text-sm font-medium">{interest.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Preferred Travel Mode */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Preferred Travel Mode:</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: "car", label: "Car", icon: FaCar },
                    { value: "walk", label: "Walk", icon: FaWalking },
                    { value: "public_transport", label: "Public Transport", icon: FaBus },
                  ].map((mode) => (
                    <label
                      key={mode.value}
                      className={`flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                        preferredTravelMode === mode.value
                          ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white/50 hover:border-emerald-300 hover:bg-emerald-50/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="travelMode"
                        value={mode.value}
                        checked={preferredTravelMode === mode.value}
                        onChange={(e) => setPreferredTravelMode(e.target.value)}
                        className="sr-only"
                      />
                      <mode.icon className="mr-2 text-lg" />
                      <span className="text-sm font-medium">{mode.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Smart Planning Options */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Smart Planning Options:</label>
                <div className="space-y-3">
                  {[
                    {
                      id: "shortestRoute",
                      label: "Shortest Route Optimization",
                      icon: FiTarget,
                      checked: shortestRouteOptimization,
                      onChange: setShortestRouteOptimization,
                    },
                    {
                      id: "topRated",
                      label: "Show Top-rated places",
                      icon: FiStar,
                      checked: showTopRatedPlaces,
                      onChange: setShowTopRatedPlaces,
                    },
                    {
                      id: "avoidCrowded",
                      label: "Avoid crowded places",
                      icon: FiUsers,
                      checked: avoidCrowdedPlaces,
                      onChange: setAvoidCrowdedPlaces,
                    },
                    {
                      id: "emailCopy",
                      label: "Send email copy of itinerary",
                      icon: FiMail,
                      checked: sendEmailCopy,
                      onChange: setSendEmailCopy,
                    },
                  ].map((option) => (
                    <label
                      key={option.id}
                      className="flex items-center p-3 rounded-xl border border-slate-200 bg-white/50 hover:bg-white/80 cursor-pointer transition-all duration-200"
                    >
                      <input
                        type="checkbox"
                        checked={option.checked}
                        onChange={(e) => option.onChange(e.target.checked)}
                        className="h-5 w-5 text-sky-600 rounded focus:ring-sky-500 border-slate-300 mr-3"
                      />
                      <option.icon className="mr-2 text-slate-600" />
                      <span className="text-sm font-medium">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Form Submission Button */}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-semibold py-4 rounded-xl shadow-lg transition-all duration-300 ease-in-out transform hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                disabled={loadingPlan}
              >
                {loadingPlan ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Generating Plan...</span>
                  </>
                ) : (
                  <>
                    <FiMapPin className="w-5 h-5" />
                    <span>Generate Trip Plan</span>
                  </>
                )}
              </button>

              {formMessage && (
                <div
                  className={`p-4 rounded-xl text-center text-sm font-medium ${
                    formMessageType === "success"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-rose-50 text-rose-700 border border-rose-200"
                  }`}
                >
                  {formMessage}
                </div>
              )}
            </form>
          </div>

          {/* Right Column: AI Interaction & Tips */}
          <div className="flex flex-col space-y-6">
            {/* Tips for a Better Trip Plan */}
            <div className="p-6 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border border-amber-200">
              <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                <FiStar className="mr-2 text-amber-500" />
                Tips for a Better Trip Plan
              </h4>
              <ul className="text-slate-600 text-sm space-y-2">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-amber-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Be specific with your interests (e.g., &quot;historical museums&quot; instead of &quot;art&quot;).
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-amber-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Consider the duration carefully; longer trips allow for more detailed itineraries.
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-amber-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Use the &quot;Advanced AI Interaction&quot; chat to refine your generated plan.
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-amber-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Experiment with different travel modes and planning options.
                </li>
              </ul>
            </div>

            {/* Advanced AI Interaction */}
            <div className="p-6 bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-200 flex flex-col h-full">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-lg font-bold text-slate-800 flex items-center">
                  <FiMessageSquare className="mr-2 text-violet-500" />
                  <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                    AI Travel Assistant
                  </span>
                </h4>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1 text-xs text-slate-500">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span>Online</span>
                  </div>
                  <button
                    onClick={() => setShowChat(!showChat)}
                    className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-full text-sm hover:from-violet-600 hover:to-purple-600 transition-all duration-200 font-medium shadow-sm"
                  >
                    {showChat ? "Hide Chat" : "Start Chat"}
                  </button>
                </div>
              </div>

              {!showChat ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-violet-400 to-purple-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiMessageSquare className="text-white text-2xl" />
                  </div>
                  <h5 className="text-lg font-semibold text-slate-800 mb-2">Ready to Help!</h5>
                  <p className="text-slate-600 text-sm mb-4">
                    Generate your trip first, then chat with our AI to refine and personalize your itinerary.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {["Smart", "Personalized", "Instant"].map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col flex-grow">
                  <p className="text-sm text-slate-600 mb-4 p-3 bg-white/50 rounded-lg border border-violet-200">
                    💡 <strong>Pro Tip:</strong> Ask me to modify your itinerary, add specific types of places, or
                    adjust for your preferences!
                  </p>

                  {/* Quick Suggestions */}
                  {chatHistory.length === 0 && currentTripId && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center">
                        <FiZap className="mr-1 text-amber-500" /> Quick Suggestions
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {quickSuggestions.slice(0, 3).map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => setChatInput(suggestion)}
                            className="px-3 py-1 bg-white/70 border border-violet-200 rounded-full text-xs text-slate-600 hover:bg-violet-50 hover:border-violet-300 transition-all duration-200"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    ref={chatContainerRef}
                    className="flex-grow bg-white/70 backdrop-blur-sm p-4 rounded-xl border border-violet-200 overflow-y-auto mb-4 min-h-[250px] max-h-[350px] custom-scrollbar"
                  >
                    {chatHistory.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-12 h-12 bg-gradient-to-br from-violet-400 to-purple-400 rounded-full flex items-center justify-center mx-auto mb-4">
                          <FiMessageSquare className="text-white text-xl" />
                        </div>
                        <p className="text-slate-500 italic mb-2">Ready to chat!</p>
                        <p className="text-xs text-slate-400">
                          Generate your trip plan first, then I&apos;ll help you refine it.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {chatHistory.map((msg, index) => (
                          <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${
                                msg.role === "user"
                                  ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white"
                                  : "bg-white border border-slate-200 text-slate-700"
                              }`}
                            >
                              <div className="flex items-center mb-2">
                                <div
                                  className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${
                                    msg.role === "user" ? "bg-white/20" : "bg-violet-100"
                                  }`}
                                >
                                  {msg.role === "user" ? (
                                    <span className="text-xs font-bold text-white">You</span>
                                  ) : (
                                    <FiMessageSquare className="text-violet-500 text-xs" />
                                  )}
                                </div>
                                <span
                                  className={`text-xs font-semibold ${
                                    msg.role === "user" ? "text-white/80" : "text-slate-500"
                                  }`}
                                >
                                  {msg.role === "user" ? "You" : "AI Assistant"}
                                </span>
                              </div>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.parts[0].text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {chatLoading && (
                      <div className="flex justify-start mb-4">
                        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm max-w-[85%]">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center">
                              <FiMessageSquare className="text-violet-500 text-xs" />
                            </div>
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"></div>
                              <div
                                className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                                style={{ animationDelay: "0.1s" }}
                              ></div>
                              <div
                                className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                                style={{ animationDelay: "0.2s" }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleChatSubmit} className="space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-grow relative">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Ask me to refine your plan... (e.g., 'Add more museums')"
                          className="w-full p-4 pr-12 border border-violet-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent text-sm bg-white/70 backdrop-blur-sm placeholder-slate-400"
                          disabled={!currentTripId || chatLoading}
                        />
                        <button
                          type="submit"
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg hover:from-violet-600 hover:to-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!currentTripId || chatLoading || !chatInput.trim()}
                        >
                          <FiSend className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex gap-2">
                        {quickSuggestions.slice(3, 6).map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => setChatInput(suggestion)}
                            className="px-3 py-1 bg-white/50 border border-violet-200 rounded-full text-xs text-slate-600 hover:bg-violet-50 hover:border-violet-300 transition-all duration-200"
                            disabled={!currentTripId || chatLoading}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleGeneratePlan()}
                        className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loadingPlan}
                        title="Regenerate Plan"
                      >
                        <FiRefreshCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Display Suggested Places */}
      {suggestedPlaces.length > 0 && (
        <div className="mt-8 backdrop-blur-sm rounded-3xl shadow-xl border bg-white/70 border-white/50 p-8">
          <div className="text-center mb-8">
            <h3 className="text-3xl font-bold text-slate-800 mb-3">Your AI-Generated Itinerary</h3>
            <p className="text-slate-600 text-lg">
              Your personalized travel plan is ready! Explore these amazing destinations.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {suggestedPlaces.map((place, index) => (
              <div
                key={index}
                className="group border border-slate-200 rounded-2xl p-6 bg-gradient-to-br from-white to-sky-50/30 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-bold text-lg text-slate-800 group-hover:text-sky-600 transition-colors">
                    {place.name}
                  </h4>
                  <FiMapPin className="text-sky-500 mt-1 flex-shrink-0" />
                </div>
                <p className="text-slate-600 text-sm mb-4 leading-relaxed">{place.description}</p>
                {place.time_to_visit && (
                  <div className="flex items-center text-xs text-slate-500 bg-slate-100 rounded-lg px-3 py-2">
                    <FiClock className="mr-2" />
                    <span>Estimated Time: {place.time_to_visit}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col lg:flex-row gap-6 justify-center items-center">
            {/* View Map Section */}
            <div className="backdrop-blur-sm rounded-2xl shadow-lg border bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 p-6 flex-1 min-w-0">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiMap className="text-white text-2xl" />
                </div>
                <h4 className="text-xl font-bold text-slate-800 mb-2">Interactive Map View</h4>
                <p className="text-slate-600 text-sm mb-4">
                  Visualize your itinerary on an "interactive map with routes and locations."
                </p>
                <div className="flex items-center justify-center space-x-4 text-xs text-slate-500 mb-4">
                  <div className="flex items-center">
                    <FiNavigation className="mr-1" />
                    <span>Routes</span>
                  </div>
                  <div className="flex items-center">
                    <FiMapPin className="mr-1" />
                    <span>Locations</span>
                  </div>
                  <div className="flex items-center">
                    <FiClock className="mr-1" />
                    <span>Timing</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (currentTripId) {
                      // For now, we'll navigate to the trip details page which should have map functionality
                      router.push(`/view-map?tripId=${currentTripId}`);
                    }
                  }}
                  className="w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!currentTripId}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <FiMap className="w-4 h-4" />
                    <span>View on Map</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Trip Details Section */}
            <div className="backdrop-blur-sm rounded-2xl shadow-lg border bg-gradient-to-br from-sky-50 to-blue-50 border-sky-200 p-6 flex-1 min-w-0">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-sky-400 to-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiCompass className="text-white text-2xl" />
                </div>
                <h4 className="text-xl font-bold text-slate-800 mb-2">Complete Trip Details</h4>
                <p className="text-slate-600 text-sm mb-4">
                  View your full itinerary with detailed information, timings, and recommendations.
                </p>
                <div className="flex items-center justify-center space-x-4 text-xs text-slate-500 mb-4">
                  <div className="flex items-center">
                    <FiClock className="mr-1" />
                    <span>Schedule</span>
                  </div>
                  <div className="flex items-center">
                    <FiStar className="mr-1" />
                    <span>Reviews</span>
                  </div>
                  <div className="flex items-center">
                    <FiMapPin className="mr-1" />
                    <span>Details</span>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/trip/${currentTripId}`)}
                  className="w-full px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!currentTripId}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <FiCompass className="w-4 h-4" />
                    <span>View Trip Details</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}

// The main page component that wraps InnerPlanTripPage in Suspense
export default function PlanTripPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-emerald-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4"></div>
          <p className="text-slate-600 text-lg font-medium">Loading trip planner...</p>
        </div>
      </div>
    }>
      <InnerPlanTripPage />
    </Suspense>
  );
}
git add app/plan-trip/page.tsx