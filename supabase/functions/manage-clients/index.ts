import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Créer un client Supabase avec la clé de service
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Créer un client normal pour vérifier les permissions
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Vérifier l'authentification
    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Non autorisé')
    }

    // Vérifier que l'utilisateur est admin
    const { data: currentClient, error: clientError } = await supabaseClient
      .from('clients')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (clientError || currentClient?.role !== 'admin') {
      throw new Error('Seuls les administrateurs peuvent gérer les clients')
    }

    const { action, clientData } = await req.json()

    switch (action) {
      case 'CREATE_CLIENT': {
        const { nom, email, telephone, role, password } = clientData

        // Créer l'utilisateur avec la clé admin
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          user_metadata: {
            nom,
            role
          }
        })

        if (authError) throw authError

        // Créer le client dans la table
        const { data: client, error: clientError } = await supabaseAdmin
          .from('clients')
          .insert([{
            user_id: authData.user.id,
            nom,
            email,
            telephone: telephone || null,
            role
          }])
          .select()
          .single()

        if (clientError) {
          // Rollback : supprimer l'utilisateur auth en cas d'erreur
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
          throw clientError
        }

        return new Response(
          JSON.stringify({ success: true, data: client }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      }

      case 'DELETE_CLIENT': {
        const { clientId, userId } = clientData

        // Supprimer le client de la table
        const { error: clientError } = await supabaseAdmin
          .from('clients')
          .delete()
          .eq('id', clientId)

        if (clientError) throw clientError

        // Supprimer l'utilisateur auth
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if (authError) {
          console.warn('Erreur lors de la suppression de l\'utilisateur auth:', authError)
        }

        return new Response(
          JSON.stringify({ success: true }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      }

      default:
        throw new Error('Action non supportée')
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})