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

    const { credential, userId } = await req.json();

    if (!credential || !userId) {
      throw new Error('Credencial o userId faltante');
    }

    // Verificar que la credencial existe
    const { data: storedCred, error: credError } = await supabaseClient
      .from('webauthn_credentials')
      .select('*')
      .eq('credential_id', credential.id)
      .eq('user_id', userId)
      .single();

    if (credError || !storedCred) {
      throw new Error('Credencial no encontrada');
    }

    // Actualizar el contador y última vez usado
    await supabaseClient
      .from('webauthn_credentials')
      .update({
        counter: storedCred.counter + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', storedCred.id);

    // Generar un token de sesión para el usuario
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.admin.generateLink({
      type: 'magiclink',
      email: (await supabaseClient.auth.admin.getUserById(userId)).data.user?.email ?? '',
    });

    if (sessionError) {
      throw sessionError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        session: sessionData,
      }),
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