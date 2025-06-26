import emailWorker from './email';
import notificationsWorker from './notifications';
import { validateApiKey } from './auth';

interface Env {
  // Authentication
  API_KEY: string;
  
  // Email worker environment variables
  AZURE_COMMUNICATION_CONNECTION_STRING?: string;
  FROM_EMAIL?: string;
  
  // Notifications worker environment variables
  AZURE_NOTIFICATION_HUB_CONNECTION_STRING?: string;
  AZURE_NOTIFICATION_HUB_NAME?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Validate API key first
    const authError = validateApiKey(request, env);
    if (authError) {
      return authError;
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Route to email endpoint
    if (path === '/email' || path === '/email/') {
      return emailWorker.fetch(request, env);
    }

    // Route to notifications endpoint
    if (path === '/notifications' || path === '/notifications/') {
      return notificationsWorker.fetch(request, env);
    }

    // Health check endpoint (no auth required)
    if (path === '/health' || path === '/') {
      return new Response(
        JSON.stringify({
          status: 'healthy',
          endpoints: {
            email: '/email',
            notifications: '/notifications',
            health: '/health'
          },
          authentication: 'API key required for protected endpoints',
          timestamp: new Date().toISOString()
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Handle 404 for unknown paths
    return new Response(
      JSON.stringify({
        error: 'Not Found',
        message: 'Available endpoints: /email, /notifications, /health',
        path: path
      }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};