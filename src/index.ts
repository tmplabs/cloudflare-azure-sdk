import { EmailClient } from '@azure/communication-email';
import { DefaultAzureCredential, ClientSecretCredential } from '@azure/identity';

export interface Env {
  // Azure Communication Services configuration
  AZURE_COMMUNICATION_CONNECTION_STRING?: string;
  AZURE_CLIENT_ID?: string;
  AZURE_CLIENT_SECRET?: string;
  AZURE_TENANT_ID?: string;
  AZURE_COMMUNICATION_ENDPOINT?: string;
  
  // Optional: Rate limiting and security
  ALLOWED_ORIGINS?: string;
  MAX_EMAILS_PER_HOUR?: string;
  
  // Logging
  LOG_LEVEL?: string;
}

export interface EmailRequest {
  to: string | string[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Array<{
    name: string;
    contentType: string;
    contentInBase64: string;
  }>;
}

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: string;
}

class AzureEmailService {
  private emailClient: EmailClient;
  private logger: Logger;

  constructor(env: Env, logger: Logger) {
    this.logger = logger;
    this.emailClient = this.initializeEmailClient(env);
  }

  private initializeEmailClient(env: Env): EmailClient {
    try {
      // Method 1: Using connection string (recommended for simplicity)
      if (env.AZURE_COMMUNICATION_CONNECTION_STRING) {
        this.logger.info('Initializing Azure Email Client with connection string');
        return new EmailClient(env.AZURE_COMMUNICATION_CONNECTION_STRING);
      }

      // Method 2: Using endpoint and credentials
      if (env.AZURE_COMMUNICATION_ENDPOINT && env.AZURE_CLIENT_ID && env.AZURE_CLIENT_SECRET && env.AZURE_TENANT_ID) {
        this.logger.info('Initializing Azure Email Client with client credentials');
        const credential = new ClientSecretCredential(
          env.AZURE_TENANT_ID,
          env.AZURE_CLIENT_ID,
          env.AZURE_CLIENT_SECRET
        );
        return new EmailClient(env.AZURE_COMMUNICATION_ENDPOINT, credential);
      }

      throw new Error('Missing required Azure Communication Services configuration');
    } catch (error) {
      this.logger.error('Failed to initialize Azure Email Client', error);
      throw error;
    }
  }

  async sendEmail(emailRequest: EmailRequest): Promise<EmailResponse> {
    const timestamp = new Date().toISOString();
    
    try {
      this.logger.info('Sending email', { 
        to: emailRequest.to, 
        subject: emailRequest.subject,
        timestamp 
      });

      // Validate email request
      this.validateEmailRequest(emailRequest);

      // Prepare email message
      const emailMessage = {
        senderAddress: emailRequest.from || 'noreply@your-domain.com',
        content: {
          subject: emailRequest.subject,
          html: emailRequest.htmlContent,
          plainText: emailRequest.textContent,
        },
        recipients: {
          to: Array.isArray(emailRequest.to) 
            ? emailRequest.to.map(email => ({ address: email }))
            : [{ address: emailRequest.to }],
          cc: emailRequest.cc 
            ? Array.isArray(emailRequest.cc)
              ? emailRequest.cc.map(email => ({ address: email }))
              : [{ address: emailRequest.cc }]
            : undefined,
          bcc: emailRequest.bcc
            ? Array.isArray(emailRequest.bcc)
              ? emailRequest.bcc.map(email => ({ address: email }))
              : [{ address: emailRequest.bcc }]
            : undefined,
        },
        replyTo: emailRequest.replyTo 
          ? [{ address: emailRequest.replyTo }] 
          : undefined,
        attachments: emailRequest.attachments?.map(att => ({
          name: att.name,
          contentType: att.contentType,
          contentInBase64: att.contentInBase64,
        })),
      };

      // Send email
      const poller = await this.emailClient.beginSend(emailMessage);
      const result = await poller.pollUntilDone();

      this.logger.info('Email sent successfully', { 
        messageId: result.id,
        timestamp
      });

      return {
        success: true,
        messageId: result.id,
        timestamp,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to send email', { error: errorMessage, timestamp });
      
      return {
        success: false,
        error: errorMessage,
        timestamp,
      };
    }
  }

  private validateEmailRequest(emailRequest: EmailRequest): void {
    if (!emailRequest.to || (Array.isArray(emailRequest.to) && emailRequest.to.length === 0)) {
      throw new Error('Recipient email address is required');
    }

    if (!emailRequest.subject) {
      throw new Error('Email subject is required');
    }

    if (!emailRequest.htmlContent && !emailRequest.textContent) {
      throw new Error('Either HTML content or text content is required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const recipients = Array.isArray(emailRequest.to) ? emailRequest.to : [emailRequest.to];
    
    for (const email of recipients) {
      if (!emailRegex.test(email)) {
        throw new Error(`Invalid email format: ${email}`);
      }
    }
  }
}

class Logger {
  private logLevel: string;

  constructor(logLevel: string = 'info') {
    this.logLevel = logLevel.toLowerCase();
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      console.log(JSON.stringify({ level: 'INFO', message, data, timestamp: new Date().toISOString() }));
    }
  }

  error(message: string, data?: any): void {
    if (this.shouldLog('error')) {
      console.error(JSON.stringify({ level: 'ERROR', message, data, timestamp: new Date().toISOString() }));
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(JSON.stringify({ level: 'WARN', message, data, timestamp: new Date().toISOString() }));
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }
}

class SecurityValidator {
  private allowedOrigins: string[];

  constructor(allowedOrigins: string = '*') {
    this.allowedOrigins = allowedOrigins === '*' ? ['*'] : allowedOrigins.split(',');
  }

  validateOrigin(request: Request): boolean {
    if (this.allowedOrigins.includes('*')) return true;
    
    const origin = request.headers.get('Origin');
    return origin ? this.allowedOrigins.includes(origin) : false;
  }

  validateContentType(request: Request): boolean {
    const contentType = request.headers.get('Content-Type');
    return contentType?.includes('application/json') || false;
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const logger = new Logger(env.LOG_LEVEL);
    const security = new SecurityValidator(env.ALLOWED_ORIGINS);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      // Security validations
      if (!security.validateOrigin(request)) {
        logger.warn('Request from unauthorized origin', {
          origin: request.headers.get('Origin')
        });
        return new Response(JSON.stringify({ error: 'Unauthorized origin' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!security.validateContentType(request)) {
        return new Response(JSON.stringify({ error: 'Invalid content type' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Parse request body
      let emailRequest: EmailRequest;
      try {
        emailRequest = await request.json() as EmailRequest;
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Initialize email service and send email
      const emailService = new AzureEmailService(env, logger);
      const result = await emailService.sendEmail(emailRequest);

      const status = result.success ? 200 : 500;
      return new Response(JSON.stringify(result), {
        status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Internal server error';
      logger.error('Unhandled error in worker', { error: errorMessage });
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: errorMessage,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};