// app/plan-trip/page.tsx
// This is a Server Component that wraps the client-side PlanTripContent
// with a Suspense boundary and uses dynamic import with ssr: false
// to handle useSearchParams during static rendering.

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic'; // Import dynamic from next/dynamic

// Dynamically import PlanTripContent with ssr: false
// This ensures that PlanTripContent (and thus useSearchParams) is never
// included in the server-side build, resolving the prerendering error.
const PlanTripContent = dynamic(() => import('@/components/PlanTripContent'), {
  ssr: false, // This is the key: do not render this component on the server
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-emerald-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4"></div>
        <p className="text-slate-600 text-lg font-medium">Loading trip planning interface...</p>
      </div>
    </div>
  ),
});

// This page will be dynamically rendered on the server for each request
// due to the nature of useSearchParams, but the Suspense boundary
// ensures a fallback is shown during initial render if needed.
export const dynamic = 'force-dynamic';

export default function PlanTripPageWrapper() {
  return (
    // The Suspense fallback here will be shown while the client-side
    // PlanTripContent component is being loaded and hydrated.
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-emerald-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4"></div>
          <p className="text-slate-600 text-lg font-medium">Loading trip planning interface...</p>
        </div>
      </div>
    }>
      <PlanTripContent />
    </Suspense>
  );
}
