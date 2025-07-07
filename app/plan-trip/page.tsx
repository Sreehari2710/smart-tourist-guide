// app/plan-trip/page.tsx
// This is a Server Component that wraps the client-side PlanTripContent
// with a Suspense boundary to handle useSearchParams during static rendering.

import React, { Suspense } from 'react';
import PlanTripContent from '@/components/PlanTripContent'; // Import the client component

// This page will be dynamically rendered on the server for each request
// due to the nature of useSearchParams, but the Suspense boundary
// ensures a fallback is shown during initial render if needed.
export const dynamic = 'force-dynamic';

export default function PlanTripPageWrapper() {
  return (
    // Wrap the client component with Suspense.
    // The fallback can be a loading spinner, skeleton, or simple text.
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
