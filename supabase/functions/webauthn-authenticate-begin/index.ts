import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { email } = await req.json();

    if (!email) {
      throw new Error('Email requerido');
    }

    // Buscar el usuario por email
    const { data: userData, error: userError } = await supabaseClient.auth.admin.listUsers();
    
    if (userError) {
      throw userError;
    }

    const user = userData.users.find(u => u.email === email);
    
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Obtener las credenciales del usuario
    const { data: credentials, error: credError } = await supabaseClient
      .from('webauthn_credentials')
      .select('credential_id')
      .eq('user_id', user.id);

    if (credError) {
      throw credError;
    }

    if (!credentials || credentials.length === 0) {
      throw new Error('No hay credenciales registradas para este usuario');
    }

    // Generar un challenge aleatorio
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const challengeBase64 = btoa(String.fromCharCode(...challenge));

    const options = {
      challenge: challengeBase64,
      timeout: 60000,
      rpId: new URL(Deno.env.get('SUPABASE_URL') ?? '').hostname,
      allowCredentials: credentials.map(cred => ({
        type: "public-key",
        id: cred.credential_id,
      })),
      userVerification: "required",
    };

    return new Response(
      JSON.stringify({ options, userId: user.id }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});