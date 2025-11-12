import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: "Authentication failed", details: userError.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    if (!user) {
      console.error('No user found');
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('User authenticated:', user.id);

    // Parse request body
    const { exchange } = await req.json();
    
    if (!exchange) {
      throw new Error('Exchange name is required');
    }

    // Delete credentials from exchange_credentials
    const { error: deleteCredsError } = await supabaseClient
      .from('exchange_credentials')
      .delete()
      .eq('user_id', user.id)
      .eq('exchange_name', exchange);

    if (deleteCredsError) {
      console.error('Error deleting credentials:', deleteCredsError);
      throw deleteCredsError;
    }

    // Update or delete connection status in exchange_connections
    const { error: deleteConnError } = await supabaseClient
      .from('exchange_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('exchange_name', exchange);

    if (deleteConnError) {
      console.error('Error deleting connection:', deleteConnError);
      throw deleteConnError;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `${exchange} disconnected successfully` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in disconnect-exchange:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});