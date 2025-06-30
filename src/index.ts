const { EmailClient } = require("@azure/communication-email");

export default {
  async fetch(request, env, ctx) {
    try {
      // Only allow POST requests
      if (request.method !== 'POST') {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Method not allowed. Use POST.' 
          }),
          { 
            status: 405, 
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      }

      // Parse request body
      let requestData;
      try {
        requestData = await request.json();
      } catch (e) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid JSON in request body' 
          }),
          { 
            status: 400, 
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      }

      // Validate required fields
      const { recipientEmail, recipientName, subject, message } = requestData;
      
      if (!recipientEmail || !recipientName || !subject || !message) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Missing required fields: recipientEmail, recipientName, subject, message' 
          }),
          { 
            status: 400, 
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipientEmail)) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid email format' 
          }),
          { 
            status: 400, 
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      }

      const ACS_ENDPOINT = env.ACS_ENDPOINT;
      const ACS_KEY = env.ACS_KEY;
      const SENDER = env.ACS_SENDER;

      // Initialize the EmailClient with the connection string
      const connectionString = `endpoint=${ACS_ENDPOINT};accesskey=${ACS_KEY}`;
      const client = new EmailClient(connectionString);

      // Create the email message
      const emailMessage = {
        senderAddress: SENDER,
        content: {
          subject: subject,
          plainText: message,
          html: requestData.htmlMessage || `<p>${message.replace(/\n/g, '<br>')}</p>`, // Optional HTML version
        },
        recipients: {
          to: [
            {
              address: recipientEmail,
              displayName: recipientName,
            },
          ],
          cc: requestData.cc || [], // Optional CC recipients
          bcc: requestData.bcc || [], // Optional BCC recipients
        },
      };

      console.log("Sending ACS Email:");
      console.log("Sender:", SENDER);
      console.log("Recipient:", `${recipientName} <${recipientEmail}>`);
      console.log("Subject:", subject);

      // Send the email
      const poller = await client.beginSend(emailMessage);
      
      // Wait for the email to be sent
      const result = await poller.pollUntilDone();

      console.log("Email sent successfully:", {
        id: result.id,
        status: result.status,
      });

      return new Response(
        JSON.stringify(
          {
            success: true,
            messageId: result.id,
            status: result.status,
            recipient: {
              email: recipientEmail,
              name: recipientName
            },
            subject: subject,
            timestamp: new Date().toISOString()
          },
          null,
          2
        ),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', // Enable CORS
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          } 
        }
      );
    } catch (err) {
      console.error("Worker Error:", err.message);
      console.error("Error details:", err);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: err.message,
          details: err.toString(),
          timestamp: new Date().toISOString()
        }, null, 2),
        {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          },
        }
      );
    }
  },
};