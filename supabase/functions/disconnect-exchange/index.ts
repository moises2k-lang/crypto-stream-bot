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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Get JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create Supabase client with user's JWT
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse request body
    const { exchange } = await req.json();
    
    if (!exchange) {
      throw new Error('Exchange name is required');
    }

    // Delete credentials from exchange_credentials
    const { error: deleteCredsError } = await supabase
      .from('exchange_credentials')
      .delete()
      .eq('user_id', user.id)
      .eq('exchange_name', exchange);

    if (deleteCredsError) {
      console.error('Error deleting credentials:', deleteCredsError);
      throw deleteCredsError;
    }

    // Update or delete connection status in exchange_connections
    const { error: deleteConnError } = await supabase
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