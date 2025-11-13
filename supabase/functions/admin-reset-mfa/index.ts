import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      throw new Error('Unauthorized: Admin access required');
    }

    const { userId } = await req.json();

    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log('Admin resetting MFA for user:', userId);

    // List all MFA factors for the user
    const { data: factorsData, error: factorsError } = await supabaseAdmin.auth.admin.mfa.listFactors({
      userId: userId
    });

    if (factorsError) {
      console.error('Error listing factors:', factorsError);
      throw new Error(`Error listing MFA factors: ${factorsError.message}`);
    }

    console.log('Found factors:', factorsData);

    // Delete all TOTP factors
    if (factorsData?.factors && factorsData.factors.length > 0) {
      for (const factor of factorsData.factors) {
        if (factor.factor_type === 'totp') {
          const { error: deleteError } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
            id: factor.id,
            userId: userId
          });

          if (deleteError) {
            console.error('Error deleting factor:', deleteError);
            throw new Error(`Error deleting MFA factor: ${deleteError.message}`);
          }

          console.log('Successfully deleted factor:', factor.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'MFA reset successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    console.error('Error in admin-reset-mfa:', error);
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
