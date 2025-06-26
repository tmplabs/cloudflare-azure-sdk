import { NotificationHubsClient } from '@azure/notification-hubs';
import { validateApiKey } from './auth';

interface NotificationRequest {
  platform: 'apns' | 'fcm' | 'wns' | 'mpns' | 'adm' | 'baidu';
  message: string;
  title?: string;
  tags?: string[];
  deviceHandle?: string; // For direct send to specific device
  templateName?: string; // For template notifications
  templateProperties?: Record<string, string>;
}

interface Env {
  API_KEY: string;
  AZURE_NOTIFICATION_HUB_CONNECTION_STRING: string;
  AZURE_NOTIFICATION_HUB_NAME: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Validate API key
    const authError = validateApiKey(request, env);
    if (authError) {
      return authError;
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // Parse request body
      const notificationRequest: NotificationRequest = await request.json();

      // Validate required fields
      if (!notificationRequest.platform || !notificationRequest.message) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: platform, message' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Validate environment variables
      if (!env.AZURE_NOTIFICATION_HUB_CONNECTION_STRING || !env.AZURE_NOTIFICATION_HUB_NAME) {
        return new Response(
          JSON.stringify({ error: 'Missing Azure Notification Hub configuration' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Create Azure Notification Hub client
      const client = new NotificationHubsClient(
        env.AZURE_NOTIFICATION_HUB_CONNECTION_STRING,
        env.AZURE_NOTIFICATION_HUB_NAME
      );

      let result;

      // Handle template notifications
      if (notificationRequest.templateName && notificationRequest.templateProperties) {
        const templateNotification = {
          body: JSON.stringify(notificationRequest.templateProperties),
          headers: {},
          contentType: 'application/json;charset=utf-8'
        };

        if (notificationRequest.deviceHandle) {
          // Send template notification to specific device
          result = await client.sendDirectNotification(
            templateNotification,
            { deviceHandle: notificationRequest.deviceHandle }
          );
        } else {
          // Send template notification with tags
          result = await client.sendNotification(
            templateNotification,
            { tags: notificationRequest.tags }
          );
        }
      } else {
        // Handle platform-specific notifications
        let notification;

        switch (notificationRequest.platform) {
          case 'apns':
            notification = {
              body: JSON.stringify({
                aps: {
                  alert: {
                    title: notificationRequest.title || 'Notification',
                    body: notificationRequest.message
                  },
                  sound: 'default'
                }
              }),
              headers: { 'apns-priority': '10' },
              contentType: 'application/json;charset=utf-8'
            };
            break;

          case 'fcm':
            notification = {
              body: JSON.stringify({
                notification: {
                  title: notificationRequest.title || 'Notification',
                  body: notificationRequest.message
                },
                data: {
                  timestamp: new Date().toISOString()
                }
              }),
              headers: {},
              contentType: 'application/json;charset=utf-8'
            };
            break;

          case 'wns':
            const toastXml = `
              <toast>
                <visual>
                  <binding template="ToastText02">
                    <text id="1">${notificationRequest.title || 'Notification'}</text>
                    <text id="2">${notificationRequest.message}</text>
                  </binding>
                </visual>
              </toast>
            `.trim();
            
            notification = {
              body: toastXml,
              headers: { 'X-WNS-Type': 'wns/toast' },
              contentType: 'text/xml'
            };
            break;

          default:
            return new Response(
              JSON.stringify({ error: `Unsupported platform: ${notificationRequest.platform}` }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        if (notificationRequest.deviceHandle) {
          // Send to specific device
          result = await client.sendDirectNotification(
            notification,
            { deviceHandle: notificationRequest.deviceHandle }
          );
        } else {
          // Send to tags or all devices
          result = await client.sendNotification(
            notification,
            { tags: notificationRequest.tags }
          );
        }
      }

      // Return success response
      return new Response(
        JSON.stringify({
          success: true,
          notificationId: result.notificationId,
          state: result.state,
          trackingId: result.trackingId
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );

    } catch (error) {
      console.error('Notification sending error:', error);
      
      return new Response(
        JSON.stringify({
          error: 'Failed to send notification',
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