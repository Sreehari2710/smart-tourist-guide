// app/layout.tsx
// This is the root layout for your Next.js application.
// It defines the basic HTML structure, includes global CSS, and sets up the Inter font.

import './globals.css'; // Global CSS file
import { Inter } from 'next/font/google'; // Google Font import

// Initialize the Inter font with Latin subset.
const inter = Inter({ subsets: ['latin'] });

// Metadata for the application, displayed in the browser tab.
export const metadata = {
  title: 'Pathora', // Application title
  description: 'Your smart companion for city exploration.', // Application description
};

// Root layout component. All pages will be rendered within this layout.
export default function RootLayout({
  children, // The 'children' prop represents the content of the current page.
}: {
  children: React.ReactNode; // Type definition for children prop
}) {
  return (
    <html lang="en">
      {/* Apply the Inter font to the body of the document */}
      <body className={inter.className}>{children}</body>
    </html>
  );
}