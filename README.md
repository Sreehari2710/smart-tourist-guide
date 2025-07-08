Smart Tourist Guide
Welcome to the Smart Tourist Guide! This is a Next.js application designed to help users plan personalized city trips with the power of AI, manage their itineraries, and visualize their routes on an interactive map. It leverages Supabase for backend services, including authentication, database storage, and Edge Functions for features like email notifications.

🌟 Features
User Authentication: Secure sign-up, login, and logout.

AI-Powered Trip Planning: Generate personalized trip itineraries based on destination, dates, duration, and interests using Google Gemini API.

Conversational AI Refinement: Refine your trip plans through an interactive chat interface.

Interactive Map View: Visualize your trip itinerary with markers for suggested places and optimized routes using OpenStreetMap data.

Trip Management: View upcoming trips, past plans, and manage individual trip details.

Itinerary Customization: Add personal notes to suggested places and mark them as visited.

Email Itinerary: Receive a copy of your detailed trip plan directly in your email inbox.

User Feedback & Support: Submit feedback and support requests directly from the dashboard.

Responsive Design: Optimized for seamless experience across various devices (desktop, tablet, mobile).

🚀 Getting Started
Follow these steps to get your Smart Tourist Guide project up and running on your local machine.

Prerequisites
Before you begin, ensure you have the following installed:

Node.js: Version 18.x or higher (LTS recommended).

npm or Yarn: npm comes with Node.js; Yarn can be installed globally (npm install -g yarn).

Supabase CLI: Required for deploying Edge Functions and managing your Supabase project locally.

macOS (Homebrew): brew install supabase/supabase/supabase

Linux (Debian/Ubuntu): sudo apt-get update && sudo apt-get install supabase

Windows (Scoop): scoop install supabase

Other (npm): npm install -g supabase (less recommended)

A Supabase Account: Sign up for a free account at supabase.com.

API Keys:

Google Gemini API Key: Obtain from Google AI Studio.

OpenRouteService (ORS) API Key: Obtain from openrouteservice.org.

SendGrid API Key: Obtain from sendgrid.com (required for email functionality).

Installation and Setup
Download or Clone the Repository:

If you downloaded a .zip file, extract it to your desired directory.
If you're using Git, clone the repository:

git clone <repository-url>
cd smart-tourist-guide # Or your project folder name

Install Dependencies:

Navigate to the project root directory in your terminal and install the Node.js dependencies:

npm install
# or
yarn install

Configure Environment Variables:

Create a .env.local file in the root of your project. This file will store your sensitive API keys and Supabase credentials.

# Supabase Credentials
NEXT_PUBLIC_SUPABASE_URL="YOUR_SUPABASE_PROJECT_URL"
NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_SUPABASE_PROJECT_ANON_KEY"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY" # Used by Edge Functions

# API Keys
NEXT_PUBLIC_GEMINI_API_KEY="YOUR_GOOGLE_GEMINI_API_KEY"
NEXT_PUBLIC_ORS_API_KEY="YOUR_OPENROUTESERVICE_API_KEY"
SENDGRID_API_KEY="YOUR_SENDGRID_API_KEY" # Used by Edge Functions

YOUR_SUPABASE_PROJECT_URL & YOUR_SUPABASE_PROJECT_ANON_KEY: Find these in your Supabase Dashboard under Project Settings > API.

YOUR_SUPABASE_SERVICE_ROLE_KEY: Also found in Project Settings > API. This key has full database privileges and must be kept secret. It's used by your Edge Functions, not directly by the frontend.

YOUR_GOOGLE_GEMINI_API_KEY: The API key you obtained from Google AI Studio.

YOUR_OPENROUTESERVICE_API_KEY: The API key you obtained from OpenRouteService.

YOUR_SENDGRID_API_KEY: The API key you obtained from SendGrid.

Supabase Database Setup:

You need to set up your Supabase database schema and functions.

a.  Link your local project to Supabase: First, log in to the Supabase CLI:

```bash
supabase login
```
Then, link your local project to your Supabase project using its reference ID (found in your Supabase Dashboard URL, e.g., `https://app.supabase.com/project/<project-ref-id>/...`):

```bash
supabase link --project-ref <your-supabase-project-ref-id>
```

b.  Run SQL Scripts: Go to your Supabase Dashboard, navigate to the SQL Editor, and run the following scripts in order:

* **`trips` table setup:**
    ```sql
    -- Create the 'trips' table
    CREATE TABLE public.trips (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES auth.users(id) NOT NULL,
        destination text NOT NULL,
        travel_date date NOT NULL,
        duration integer NOT NULL,
        interests text[] NOT NULL DEFAULT '{}',
        suggested_places jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamp with time zone DEFAULT now()
    );

    -- Enable Row Level Security (RLS) for the 'trips' table
    ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

    -- Policies for RLS
    CREATE POLICY "Allow users to view their own trips" ON public.trips FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "Allow authenticated users to create trips for themselves" ON public.trips FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Allow users to update their own trips" ON public.trips FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Allow users to delete their own trips" ON public.trips FOR DELETE USING (auth.uid() = user_id);

    -- Optional: Create an index on user_id for faster queries
    CREATE INDEX ON public.trips (user_id);
    ```

* **Alter `trips` table (add new columns):**
    ```sql
    ALTER TABLE public.trips
    ADD COLUMN IF NOT EXISTS time_per_day integer,
    ADD COLUMN IF NOT EXISTS use_current_location boolean DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS preferred_travel_mode text DEFAULT 'car',
    ADD COLUMN IF NOT EXISTS shortest_route_optimization boolean DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS show_top_rated_places boolean DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS avoid_crowded_places boolean DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS send_email_copy boolean DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS starting_point text;
    ```

* **`user_feedback` table setup:**
    ```sql
    -- Create the 'user_feedback' table
    CREATE TABLE public.user_feedback (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES auth.users(id) NOT NULL,
        rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
        feedback_text text,
        created_at timestamp with time zone DEFAULT now()
    );

    -- Enable Row Level Security (RLS) for the 'user_feedback' table
    ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

    -- Policy for INSERT
    CREATE POLICY "Allow authenticated users to insert their own feedback" ON public.user_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);

    -- Policy for SELECT
    CREATE POLICY "Allow users to view their own feedback" ON public.user_feedback FOR SELECT USING (auth.uid() = user_id);

    -- Optional: Create an index on user_id
    CREATE INDEX ON public.user_feedback (user_id);
    ```

* **`customer_support_requests` table setup:**
    ```sql
    -- Create the 'customer_support_requests' table
    CREATE TABLE public.customer_support_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES auth.users(id) NOT NULL,
        issue_description text NOT NULL,
        status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed')),
        created_at timestamp with time zone DEFAULT now()
    );

    -- Enable Row Level Security (RLS) for the 'customer_support_requests' table
    ALTER TABLE public.customer_support_requests ENABLE ROW LEVEL SECURITY;

    -- Policy for INSERT
    CREATE POLICY "Allow authenticated users to insert their own support requests" ON public.customer_support_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

    -- Policy for SELECT
    CREATE POLICY "Allow users to view their own support requests" ON public.customer_support_requests FOR SELECT USING (auth.uid() = user_id);

    -- Optional: Create an index on user_id
    CREATE INDEX ON public.customer_support_requests (user_id);
    ```

* **`profiles` table setup:**
    ```sql
    -- Create the 'profiles' table
    CREATE TABLE public.profiles (
      id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
      updated_at timestamp with time zone DEFAULT now(),
      username text UNIQUE,
      full_name text,
      phone_number text
    );

    -- Set up Row Level Security (RLS) for the 'profiles' table
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

    -- Policies for RLS
    CREATE POLICY "Allow read access to own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
    CREATE POLICY "Allow insert access for own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
    CREATE POLICY "Allow update access to own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

    -- Optional: Create a function and trigger to automatically update 'updated_at' column
    CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
    RETURNS TRIGGER AS $$
    DECLARE
      _new record;
    BEGIN
      _new := NEW;
      _new.updated_at = NOW();
      RETURN _new;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();
    ```

* **`upsert_profile` RPC function:**
    ```sql
    -- Drop any existing versions of the upsert_profile function to ensure clean re-creation
    DROP FUNCTION IF EXISTS public.upsert_profile(text, text, text);

    -- Create or replace the upsert_profile function
    CREATE OR REPLACE FUNCTION public.upsert_profile(
        p_username text,
        p_full_name text,
        p_phone_number text
    )
    RETURNS void AS $$
    BEGIN
        INSERT INTO public.profiles (id, username, full_name, phone_number, updated_at)
        VALUES (auth.uid(), p_username, p_full_name, p_phone_number, now())
        ON CONFLICT (id) DO UPDATE SET
            username = p_username,
            full_name = p_full_name,
            phone_number = p_phone_number,
            updated_at = now();
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Grant execution privileges to authenticated users
    GRANT EXECUTE ON FUNCTION public.upsert_profile(text, text, text) TO authenticated;
    ```

* **Foreign Key Constraints with `ON DELETE CASCADE`:**
    To ensure that when a user is deleted from `auth.users`, their associated data in other tables is also automatically removed, run these commands:
    ```sql
    ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_user_id_fkey;
    ALTER TABLE public.trips ADD CONSTRAINT trips_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    ALTER TABLE public.user_feedback DROP CONSTRAINT IF EXISTS user_feedback_user_id_fkey;
    ALTER TABLE public.user_feedback ADD CONSTRAINT user_feedback_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    ALTER TABLE public.customer_support_requests DROP CONSTRAINT IF EXISTS customer_support_requests_user_id_fkey;
    ALTER TABLE public.customer_support_requests ADD CONSTRAINT customer_support_requests_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    ```

Deploy Supabase Edge Functions:

You need to deploy the send-trip-email Edge Function.

a.  Set Supabase Secrets: Ensure your SUPABASE_SERVICE_ROLE_KEY and SENDGRID_API_KEY are set as Supabase secrets. If you've already added them to .env.local, you still need to set them for your Supabase project so the Edge Function can access them at runtime.

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"
supabase secrets set SENDGRID_API_KEY="YOUR_SENDGRID_API_KEY"
```

b.  Deploy the Function: Navigate to your project's root directory and deploy the send-trip-email function:

```bash
supabase functions deploy send-trip-email --no-verify-jwt
```

This will deploy the function located at `supabase/functions/send-trip-email/index.ts`.

Configure Supabase Authentication Redirect URL:

For email verification to work correctly, you need to set the redirect URL in your Supabase project settings:

Go to your Supabase Dashboard.

Navigate to Authentication (shield icon) -> URL Configuration.

Set the "Redirect URL (Email Confirmation)" to your local development URL: http://localhost:3000/

🏃 Running the Application
Once all the setup steps are complete, you can run the development server:

npm run dev
# or
yarn dev

Open http://localhost:3000 in your browser to see the application. The page will auto-update as you edit the files.

⚙️ Project Structure
app/: Next.js App Router pages and layouts.

app/page.tsx: The main login/registration page.

app/dashboard/page.tsx: User dashboard to view and manage trips.

app/plan-trip/page.tsx: Page for planning new trips with AI.

app/trip/[tripId]/page.tsx: Detailed view for a specific trip.

app/view-map/page.tsx: Interactive map view for a trip.

app/past-plans/page.tsx: Page to view historical trip plans.

app/globals.css: Global Tailwind CSS styles.

components/: Reusable React components (e.g., auth/LoginPage.tsx, auth/RegisterPage.tsx).

lib/supabase.ts: Supabase client initialization.

public/: Static assets like images (e.g., smart-city-guide login.jpg).

supabase/functions/: Supabase Edge Functions.

send-trip-email/index.ts: Edge Function for sending trip itineraries via email.

delete-user-function/index.ts: Edge Function for securely deleting user accounts and associated data.

🌐 Deployment
This project can be easily deployed to platforms like Netlify or Vercel. Both offer seamless continuous deployment from Git repositories. Remember to set your environment variables (Supabase and API keys) in their respective dashboards.

🐛 Troubleshooting
TypeError: m is not a function or issues with react-leaflet during build: Ensure that client-side components like MapContainer are dynamically imported with ssr: false and that any components using useSearchParams or window objects are marked with 'use client' and potentially wrapped in a client-side conditional render or Suspense boundary.

"Database error deleting user" from Supabase Admin UI: This is likely due to foreign key constraints. Ensure you have run the ON DELETE CASCADE SQL scripts as detailed in the "Supabase Database Setup" section.

"Failed to send email" / Edge Function errors:

Verify SENDGRID_API_KEY is correctly set as a Supabase Secret.

Ensure the from email address in send-trip-email/index.ts is a verified sender in your SendGrid account.

Check Supabase Function logs for detailed error messages during invocation.

"Gemini API Key is not set": Double-check your .env.local file and ensure NEXT_PUBLIC_GEMINI_API_KEY is correctly defined.

CORS errors when calling Edge Functions: Ensure the dynamicCorsHeaders are correctly configured in your Edge Functions to allow requests from your frontend's origin.

🤝 Contributing
Contributions are welcome! Feel free to open issues or submit pull requests.

📄 License
This project is open-source and available under the MIT License.
