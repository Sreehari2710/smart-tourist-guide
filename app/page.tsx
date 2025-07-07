// app/page.tsx
// This is the root page component for your application (the default landing page).
// It currently renders the LoginPage component.

'use client'; // Mark this component as a Client Component, as LoginPage uses useState and client-side logic.

import LoginPage from '@/components/auth/LoginPage'; // Import the LoginPage component

// The default export for the root page.
export default function Home() {
  return (
    // Render the LoginPage component as the main content of the home page.
    <LoginPage />
  );
}