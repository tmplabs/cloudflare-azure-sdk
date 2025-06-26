interface AuthEnv {
  API_KEY: string;
}

export function validateApiKey(request: Request, env: AuthEnv): Response | null {
  // Skip auth for health check endpoint
  const url = new URL(request.url);
  if (url.pathname === '/health' || url.pathname === '/') {
    return null;
  }

  // Check for API key in Authorization header
  const authHeader = request.headers.get('Authorization');
  const apiKeyFromHeader = authHeader?.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : authHeader;

  // Check for API key in x-api-key header
  const apiKeyFromCustomHeader = request.headers.get('x-api-key');

  // Check for API key in query parameter
  const apiKeyFromQuery = url.searchParams.get('api_key');

  const providedApiKey = apiKeyFromHeader || apiKeyFromCustomHeader || apiKeyFromQuery;

  // Validate API key exists in environment
  if (!env.API_KEY) {
    return new Response(
      JSON.stringify({ 
        error: 'Server configuration error',
        message: 'API authentication not configured' 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  // Validate provided API key
  if (!providedApiKey) {
    return new Response(
      JSON.stringify({ 
        error: 'Authentication required',
        message: 'API key must be provided via Authorization header, x-api-key header, or api_key query parameter' 
      }),
      { 
        status: 401, 
        headers: { 
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer'
        } 
      }
    );
  }

  // Use timing-safe comparison to prevent timing attacks
  if (!timingSafeEqual(providedApiKey, env.API_KEY)) {
    return new Response(
      JSON.stringify({ 
        error: 'Invalid API key',
        message: 'The provided API key is not valid' 
      }),
      { 
        status: 403, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  return null; // Authentication successful
}

// Timing-safe string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}