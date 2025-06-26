# Azure Workers SDK

Cloudflare Worker providing secure REST API for Azure services including Email and Push Notifications.

## Features

- **Email Service** - Send emails via Azure Communication Service
- **Push Notifications** - Send notifications via Azure Notification Hubs
- **API Key Authentication** - Secure endpoints with key-based auth
- **Multi-platform Support** - iOS, Android, Windows notifications
- **Template Notifications** - Cross-platform notification templates

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables and secrets:

```bash
# Set API key for authentication
wrangler secret put API_KEY

# Azure Communication Service (for email)
wrangler secret put AZURE_COMMUNICATION_CONNECTION_STRING
wrangler secret put FROM_EMAIL

# Azure Notification Hubs (for push notifications)  
wrangler secret put AZURE_NOTIFICATION_HUB_CONNECTION_STRING
wrangler secret put AZURE_NOTIFICATION_HUB_NAME
```

3. Deploy the worker:
```bash
npm run deploy          # Deploy to development
npm run deploy:staging  # Deploy to staging
npm run deploy:production # Deploy to production
```

## Authentication

All endpoints (except `/health`) require API key authentication. Provide your API key using one of these methods:

- **Authorization header**: `Authorization: Bearer YOUR_API_KEY`
- **Custom header**: `x-api-key: YOUR_API_KEY`  
- **Query parameter**: `?api_key=YOUR_API_KEY`

## API Endpoints

### Health Check
```bash
GET https://your-worker.workers.dev/health
# No authentication required
```

### Send Email
```bash
curl -X POST https://your-worker.workers.dev/email \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "recipient@example.com",
    "subject": "Test Email",
    "body": "Hello from Cloudflare Worker!",
    "isHtml": false
  }'
```

### Send Push Notifications

**iOS (APNS):**
```bash
curl -X POST https://your-worker.workers.dev/notifications \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "apns",
    "title": "Hello",
    "message": "Push notification from Azure!",
    "tags": ["user123", "premium"]
  }'
```

**Android (FCM):**
```bash
curl -X POST https://your-worker.workers.dev/notifications \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "fcm",
    "title": "Hello", 
    "message": "Push notification from Azure!",
    "deviceHandle": "device-token-here"
  }'
```

**Windows (WNS):**
```bash
curl -X POST https://your-worker.workers.dev/notifications?api_key=YOUR_API_KEY \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "wns",
    "title": "Hello",
    "message": "Toast notification from Azure!",
    "tags": ["location:seattle"]
  }'
```

**Template Notifications:**
```bash
curl -X POST https://your-worker.workers.dev/notifications \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "fcm",
    "templateName": "welcome", 
    "templateProperties": {
      "username": "John",
      "action": "login"
    },
    "tags": ["newuser"]
  }'
```

## Environment Variables

### Authentication
- `API_KEY`: Secure API key for endpoint authentication

### Email Service  
- `AZURE_COMMUNICATION_CONNECTION_STRING`: Azure Communication Service connection string
- `FROM_EMAIL`: Sender email address (must be verified in Azure)

### Push Notifications
- `AZURE_NOTIFICATION_HUB_CONNECTION_STRING`: Azure Notification Hub connection string  
- `AZURE_NOTIFICATION_HUB_NAME`: Name of your notification hub

## Development

Run locally:
```bash
npm run dev  # Run worker locally with hot reload
```

## Security Features

- **API Key Authentication** - All endpoints protected except health check
- **Timing-Safe Comparison** - Prevents timing attacks on API key validation
- **Multiple Auth Methods** - Support for header and query parameter auth
- **Input Validation** - Request validation and sanitization

## Supported Platforms

- **APNS** (Apple Push Notification Service) - iOS
- **FCM** (Firebase Cloud Messaging) - Android  
- **WNS** (Windows Notification Service) - Windows
- **Template Notifications** - Cross-platform templates