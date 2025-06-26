import { EmailClient } from '@azure/communication-email';

interface EmailRequest {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
}

interface Env {
  AZURE_COMMUNICATION_CONNECTION_STRING: string;
  FROM_EMAIL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // Parse request body
      const emailRequest: EmailRequest = await request.json();

      // Validate required fields
      if (!emailRequest.to || !emailRequest.subject || !emailRequest.body) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: to, subject, body' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Validate environment variables
      if (!env.AZURE_COMMUNICATION_CONNECTION_STRING || !env.FROM_EMAIL) {
        return new Response(
          JSON.stringify({ error: 'Missing Azure configuration' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Create Azure Communication Email client
      const emailClient = new EmailClient(env.AZURE_COMMUNICATION_CONNECTION_STRING);

      // Prepare email message
      const emailMessage = {
        senderAddress: env.FROM_EMAIL,
        content: {
          subject: emailRequest.subject,
          ...(emailRequest.isHtml 
            ? { html: emailRequest.body }
            : { plainText: emailRequest.body }
          )
        },
        recipients: {
          to: [{ address: emailRequest.to }]
        }
      };

      // Send email
      const poller = await emailClient.beginSend(emailMessage);
      const result = await poller.pollUntilDone();

      // Return success response
      return new Response(
        JSON.stringify({ 
          success: true, 
          messageId: result.id,
          status: result.status 
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );

    } catch (error) {
      console.error('Email sending error:', error);
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send email',
          details: error instanceof Error ? error.message : 'Unknown error'
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
  }
};