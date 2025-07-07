// supabase/functions/send-trip-email/index.ts
// This Edge Function handles sending an email with trip plan details.
// It uses SendGrid as an example. You can adapt it for other email services.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';

// Initialize Supabase client for accessing authenticated user context
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use service role key for security
);

serve(async (req) => {
  // --- VERY FIRST LOG: Confirm any request hits the function ---
  console.log(`[Edge Function Start] Received request: Method=${req.method}, URL=${req.url}, Origin=${req.headers.get('Origin')}`);

  // Dynamically set Access-Control-Allow-Origin based on the request's Origin header
  // This helps with CORS issues, especially during local development (localhost).
  const origin = req.headers.get('Origin') || '*';
  const dynamicCorsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', // Explicitly allow POST and OPTIONS
  };

  // --- CRITICAL: Handle CORS preflight requests FIRST ---
  if (req.method === 'OPTIONS') {
    console.log('Received OPTIONS preflight request. Responding with CORS headers.');
    return new Response('ok', { headers: dynamicCorsHeaders });
  }

  // If not an OPTIONS request, proceed with POST logic
  if (req.method !== 'POST') {
    console.log('Method Not Allowed:', req.method); // Log method for non-OPTIONS, non-POST requests
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    // Authenticate the user making the request (optional but recommended for security)
    const authHeader = req.headers.get('Authorization');
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader?.split(' ')[1]);

    if (authError || !user) {
      console.error('Authentication error or no user:', authError?.message || 'No user');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const requestBody = await req.json();
    const { tripPlan, recipientEmail } = requestBody;

    console.log('Received POST request for email send. Trip Plan:', tripPlan ? 'present' : 'missing', 'Recipient Email:', recipientEmail); // Log received data

    if (!tripPlan || !recipientEmail) {
      console.error('Missing tripPlan or recipientEmail in request body.');
      return new Response(JSON.stringify({ error: 'Missing tripPlan or recipientEmail' }), {
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Retrieve SendGrid API Key from environment variables (Supabase Secrets)
    const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
    if (!sendgridApiKey) {
      console.error('SENDGRID_API_KEY is not set in Edge Function environment variables.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Email API key missing.' }), {
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    console.log('SendGrid API Key retrieved successfully.');

    // Construct email content (simplified, no Google Places API fields)
    const subject = `Your Smart City Tourist Guide Plan for ${tripPlan.destination}`;
    let htmlContent = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #1E3A8A;">Your Trip Plan for ${tripPlan.destination}</h2>
        <p><strong>Travel Date:</strong> ${tripPlan.travel_date}</p>
        <p><strong>Duration:</strong> ${tripPlan.duration} days</p>
        <p><strong>Interests:</strong> ${tripPlan.interests.join(', ')}</p>
        <p><strong>Preferred Travel Mode:</strong> ${tripPlan.preferred_travel_mode?.replace('_', ' ') || 'Not specified'}</p>
        <h3 style="color: #2563EB;">Suggested Places:</h3>
        <ul style="list-style: none; padding: 0;">
    `;

    if (tripPlan.suggested_places && tripPlan.suggested_places.length > 0) {
      tripPlan.suggested_places.forEach((place: any, index: number) => {
        htmlContent += `
          <li style="margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 8px;">
            <strong style="color: #1F2937;">${index + 1}. ${place.name}</strong>
            <p style="margin-top: 5px; color: #4B5563;">${place.description}</p>
            ${place.notes ? `<p style="font-size: 0.9em; color: #666; font-style: italic;">Your Notes: ${place.notes}</p>` : ''}
          </li>
        `;
      });
    } else {
      htmlContent += `<li>No suggested places for this trip.</li>`;
    }

    htmlContent += `
        </ul>
        <p style="margin-top: 20px; font-size: 0.9em; color: #777;">
          This email was sent from your Smart City Tourist Guide.
        </p>
      </div>
    `;

    const emailPayload = {
      personalizations: [{ to: [{ email: recipientEmail }] }],
      from: { email: 'sreeharit@lpu.in', name: 'Smart City Tourist Guide' }, // IMPORTANT: Use a verified sender email from your SendGrid account
      subject: subject,
      content: [{ type: 'text/html', value: htmlContent }],
    };

    console.log('Sending email with payload:', JSON.stringify(emailPayload, null, 2)); // Log email payload

    // Send email using SendGrid API
    const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sendgridApiKey}`,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!sendgridResponse.ok) {
      let errorText = 'Unknown SendGrid error.';
      try {
        errorText = await sendgridResponse.text(); // Attempt to get error text
      } catch (e) {
        console.error('Could not parse SendGrid error response text:', e);
      }
      console.error('SendGrid API error:', sendgridResponse.status, errorText);
      return new Response(JSON.stringify({ error: `Failed to send email: ${sendgridResponse.status} - ${errorText}` }), {
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }, // Ensure CORS headers are included in error responses
        status: 500,
      });
    }

    console.log('Email sent successfully via SendGrid.');
    return new Response(JSON.stringify({ message: 'Email sent successfully!' }), {
      headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }, // Ensure CORS headers are included in success responses
      status: 200,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Edge Function caught unhandled error:', errMsg);
    return new Response(JSON.stringify({ error: errMsg || 'Internal Server Error' }), {
      headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }, // Ensure CORS headers are included in caught error responses
      status: 500,
    });
  }
});
