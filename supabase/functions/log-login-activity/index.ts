import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { userAgent, ipAddress } = await req.json();

    // Parse user agent to extract device info
    const deviceInfo = parseUserAgent(userAgent);

    // Get geolocation data from IP address
    let geoData = { country: null, city: null };
    if (ipAddress && ipAddress !== 'Client IP') {
      try {
        const geoResponse = await fetch(`https://ipapi.co/${ipAddress}/json/`);
        if (geoResponse.ok) {
          const geo = await geoResponse.json();
          geoData = {
            country: geo.country_name || null,
            city: geo.city || null
          };
        }
      } catch (geoError) {
        console.error('Error fetching geolocation:', geoError);
      }
    }

    // Log the login activity
    const { error: insertError } = await supabaseAdmin
      .from('login_history')
      .insert({
        user_id: user.id,
        ip_address: ipAddress,
        user_agent: userAgent,
        device_info: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        country: geoData.country,
        city: geoData.city,
        success: true
      });

    if (insertError) {
      console.error('Error inserting login history:', insertError);
      throw insertError;
    }

    console.log('Login activity logged for user:', user.id);

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    console.error('Error in log-login-activity:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});

function parseUserAgent(userAgent: string): { device: string; browser: string; os: string } {
  let device = 'Desktop';
  let browser = 'Unknown';
  let os = 'Unknown';

  if (!userAgent) {
    return { device, browser, os };
  }

  // Detect device type
  if (/mobile/i.test(userAgent)) {
    device = 'Mobile';
  } else if (/tablet|ipad/i.test(userAgent)) {
    device = 'Tablet';
  }

  // Detect browser
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    browser = 'Chrome';
  } else if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'Safari';
  } else if (userAgent.includes('Edg')) {
    browser = 'Edge';
  } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
    browser = 'Opera';
  }

  // Detect OS
  if (userAgent.includes('Windows')) {
    os = 'Windows';
  } else if (userAgent.includes('Mac OS')) {
    os = 'macOS';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = 'iOS';
  }

  return { device, browser, os };
}
