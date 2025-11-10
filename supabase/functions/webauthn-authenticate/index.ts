import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { email, credentialId } = await req.json();

    // Buscar usuario por email
    const { data: profiles } = await supabaseClient
      .from('profiles')
      .select('user_id')
      .eq('email', email)
      .single();

    if (!profiles) {
      throw new Error('Usuario no encontrado');
    }

    // Verificar credencial
    const { data: credential } = await supabaseClient
      .from('webauthn_credentials')
      .select('*')
      .eq('user_id', profiles.user_id)
      .eq('credential_id', credentialId)
      .single();

    if (!credential) {
      throw new Error('Credencial no válida');
    }

    // Generar sesión
    const { data, error } = await supabaseClient.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({ 
        success: true,
        access_token: data.properties.action_link.split('access_token=')[1]?.split('&')[0]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
