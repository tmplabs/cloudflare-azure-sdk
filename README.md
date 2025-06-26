# Azure Workers SDK

Cloudflare Workers for Azure services including Email and Push Notifications.

## Workers

### 1. Email Worker
Sends emails using Azure Communication Service.

### 2. Notifications Worker  
Sends push notifications using Azure Notification Hubs.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:

**For Email Worker:**
```bash
wrangler secret put AZURE_COMMUNICATION_CONNECTION_STRING
wrangler secret put FROM_EMAIL
```

**For Notifications Worker:**
```bash
wrangler secret put AZURE_NOTIFICATION_HUB_CONNECTION_STRING --env notifications
wrangler secret put AZURE_NOTIFICATION_HUB_NAME --env notifications
```

3. Deploy workers:
```bash
npm run deploy:email        # Deploy email worker
npm run deploy:notifications # Deploy notifications worker
```

## Usage

### Email Worker

Send a POST request:
```bash
curl -X POST https://your-email-worker.your-subdomain.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "to": "recipient@example.com",
    "subject": "Test Email",
    "body": "Hello from Cloudflare Worker!",
    "isHtml": false
  }'
```

### Notifications Worker

Send push notifications:

**iOS (APNS):**
```bash
curl -X POST https://your-notifications-worker.your-subdomain.workers.dev \
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
curl -X POST https://your-notifications-worker.your-subdomain.workers.dev \
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
curl -X POST https://your-notifications-worker.your-subdomain.workers.dev \
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
curl -X POST https://your-notifications-worker.your-subdomain.workers.dev \
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

### Email Worker
- `AZURE_COMMUNICATION_CONNECTION_STRING`: Azure Communication Service connection string
- `FROM_EMAIL`: Sender email address (must be verified in Azure)

### Notifications Worker
- `AZURE_NOTIFICATION_HUB_CONNECTION_STRING`: Azure Notification Hub connection string
- `AZURE_NOTIFICATION_HUB_NAME`: Name of your notification hub

## Development

Run locally:
```bash
npm run dev:email         # Run email worker locally
npm run dev:notifications # Run notifications worker locally
```

## Supported Platforms

- **APNS** (Apple Push Notification Service) - iOS
- **FCM** (Firebase Cloud Messaging) - Android  
- **WNS** (Windows Notification Service) - Windows
- **Template Notifications** - Cross-platform templates