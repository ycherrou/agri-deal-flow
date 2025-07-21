import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppNotificationRequest {
  client_id: string;
  template_name: string;
  variables: Record<string, string>;
  phone_number?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { client_id, template_name, variables, phone_number }: WhatsAppNotificationRequest = await req.json();

    console.log(`Sending WhatsApp notification to client ${client_id} with template ${template_name}`);

    // Get client information
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('nom, telephone')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      console.error('Client not found:', clientError);
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use provided phone number or client's phone number
    const targetPhone = phone_number || client.telephone;
    
    if (!targetPhone) {
      console.error('No phone number available for client:', client_id);
      return new Response(
        JSON.stringify({ error: 'No phone number available for client' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get WhatsApp template
    const { data: template, error: templateError } = await supabase
      .from('whatsapp_templates')
      .select('message_template')
      .eq('nom', template_name)
      .eq('active', true)
      .single();

    if (templateError || !template) {
      console.error('Template not found:', templateError);
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Replace variables in template
    let message = template.message_template;
    
    // Add client name to variables
    const allVariables = {
      ...variables,
      client_nom: client.nom
    };

    // Replace all {{variable}} placeholders
    for (const [key, value] of Object.entries(allVariables)) {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), value.toString());
    }

    console.log('Final message:', message);

    // Format phone number for WhatsApp (ensure it starts with + and country code)
    let formattedPhone = targetPhone.replace(/\D/g, ''); // Remove non-digits
    if (!formattedPhone.startsWith('33') && !formattedPhone.startsWith('+33')) {
      // Assume French number if no country code
      formattedPhone = '33' + formattedPhone.replace(/^0/, '');
    }
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    // Send WhatsApp message via Twilio
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioWhatsAppFrom = Deno.env.get("TWILIO_WHATSAPP_FROM");

    if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppFrom) {
      console.error('Twilio credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Twilio credentials not configured' }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const credentials = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: `whatsapp:${twilioWhatsAppFrom}`,
        To: `whatsapp:${formattedPhone}`,
        Body: message,
      }),
    });

    const twilioResult = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('Twilio error:', twilioResult);
      
      // Log failed notification attempt
      await supabase.from('notifications_history').insert({
        client_id,
        phone_number: formattedPhone,
        message_type: template_name,
        message_content: message,
        status: 'failed',
        error_message: twilioResult.message || 'Unknown Twilio error'
      });

      return new Response(
        JSON.stringify({ error: 'Failed to send WhatsApp message', details: twilioResult }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log('WhatsApp message sent successfully:', twilioResult.sid);

    // Log successful notification
    await supabase.from('notifications_history').insert({
      client_id,
      phone_number: formattedPhone,
      message_type: template_name,
      message_content: message,
      twilio_sid: twilioResult.sid,
      status: 'sent',
      sent_at: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_sid: twilioResult.sid,
        phone_number: formattedPhone 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-whatsapp-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);