import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, action, data } = await req.json();

    console.log('Admin action received:', action);

    if (!userId || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle different actions
    switch (action) {
      case 'toggle_active': {
        const { error } = await supabase
          .from('profiles')
          .update({ is_active: data.isActive })
          .eq('user_id', userId);

        if (error) throw error;
        break;
      }

      case 'reset_password': {
        console.log('Password reset initiated');
        const { error } = await supabase.auth.admin.updateUserById(userId, {
          password: data.newPassword
        });

        if (error) throw error;
        break;
      }

      case 'update_profile': {
        // Update profile
        const updateData: any = {};
        if (data.fullName !== undefined) updateData.full_name = data.fullName;
        if (data.email !== undefined) updateData.email = data.email;

        const { error: profileError } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('user_id', userId);

        if (profileError) throw profileError;

        // Update email in auth if provided
        if (data.email) {
          const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
            email: data.email
          });
          if (authError) throw authError;
        }
        break;
      }

      case 'update_role': {
        // First, remove existing roles
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId);

        // Then add new role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: data.role });

        if (error) throw error;
        break;
      }

      case 'delete_user': {
        console.log('Deleting user:', userId);
        
        // Delete user will cascade and delete all related data due to foreign key constraints
        const { error } = await supabase.auth.admin.deleteUser(userId);
        
        if (error) throw error;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in admin-update-user:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
