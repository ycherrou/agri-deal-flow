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

    // Vérifier qu'il n'y a pas déjà d'admin
    const { data: existingAdmins, error: checkError } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('role', 'admin')
      .limit(1)

    if (checkError) throw checkError

    if (existingAdmins && existingAdmins.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Un administrateur existe déjà' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    const { email, password, nom } = await req.json()

    if (!email || !password) {
      throw new Error('Email et mot de passe requis')
    }

    // Créer l'utilisateur admin
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nom: nom || 'Administrateur',
        role: 'admin'
      }
    })

    if (authError) throw authError

    // Attendre que le trigger crée le client
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Vérifier et mettre à jour le rôle si nécessaire
    const { error: updateError } = await supabaseAdmin
      .from('clients')
      .update({ role: 'admin' })
      .eq('user_id', authData.user.id)

    if (updateError) {
      console.error('Erreur lors de la mise à jour du rôle:', updateError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Compte administrateur créé avec succès',
        email: authData.user.email
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Erreur:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
