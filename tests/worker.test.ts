import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/index';

// Mock Azure Communication Services
vi.mock('@azure/communication-email', () => ({
  EmailClient: vi.fn().mockImplementation(() => ({
    beginSend: vi.fn().mockResolvedValue({
      pollUntilDone: vi.fn().mockResolvedValue({
        id: 'mock-message-id-123'
      })
    })
  }))
}));

vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: vi.fn(),
  ClientSecretCredential: vi.fn()
}));

describe('Cloudflare Azure Email Worker', () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = {
      AZURE_COMMUNICATION_CONNECTION_STRING: 'endpoint=https://mock.communication.azure.com/;accesskey=mock-key',
      LOG_LEVEL: 'info',
      ALLOWED_ORIGINS: '*'
    };
  });

  describe('Request Method Validation', () => {
    it('should reject GET requests', async () => {
      const request = new Request('https://test.com', { method: 'GET' });
      const response = await worker.fetch(request, mockEnv, {} as ExecutionContext);
      
      expect(response.status).toBe(405);
      const body = await response.json();
      expect(body.error).toBe('Method not allowed');
    });

    it('should handle OPTIONS requests for CORS', async () => {
      const request = new Request('https://test.com', { method: 'OPTIONS' });
      const response = await worker.fetch(request, mockEnv, {} as ExecutionContext);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
    });
  });

  describe('Email Validation', () => {
    it('should reject requests without recipient', async () => {
      const emailData = {
        subject: 'Test Subject',
        textContent: 'Test content'
      };

      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });

      const response = await worker.fetch(request, mockEnv, {} as ExecutionContext);
      const body = await response.json();
      
      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Recipient email address is required');
    });

    it('should reject requests without subject', async () => {
      const emailData = {
        to: 'test@example.com',
        textContent: 'Test content'
      };

      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });

      const response = await worker.fetch(request, mockEnv, {} as ExecutionContext);
      const body = await response.json();
      
      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Email subject is required');
    });

    it('should reject requests without content', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject'
      };

      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });

      const response = await worker.fetch(request, mockEnv, {} as ExecutionContext);
      const body = await response.json();
      
      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Either HTML content or text content is required');
    });

    it('should reject invalid email formats', async () => {
      const emailData = {
        to: 'invalid-email',
        subject: 'Test Subject',
        textContent: 'Test content'
      };

      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });

      const response = await worker.fetch(request, mockEnv, {} as ExecutionContext);
      const body = await response.json();
      
      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Invalid email format');
    });
  });

  describe('Content Type Validation', () => {
    it('should reject requests with invalid content type', async () => {
      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'invalid body'
      });

      const response = await worker.fetch(request, mockEnv, {} as ExecutionContext);
      const body = await response.json();
      
      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid content type');
    });

    it('should reject malformed JSON', async () => {
      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });

      const response = await worker.fetch(request, mockEnv, {} as ExecutionContext);
      const body = await response.json();
      
      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid JSON in request body');
    });
  });

  describe('Origin Validation', () => {
    it('should allow requests from allowed origins', async () => {
      mockEnv.ALLOWED_ORIGINS = 'https://example.com';
      
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        textContent: 'Test content'
      };

      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://example.com'
        },
        body: JSON.stringify(emailData)
      });

      const response = await worker.fetch(request, mockEnv, {} as ExecutionContext);
      
      // Should not be rejected for origin (will fail later on email validation)
      expect(response.status).not.toBe(403);
    });

    it('should reject requests from unauthorized origins', async () => {
      mockEnv.ALLOWED_ORIGINS = 'https://example.com';
      
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        textContent: 'Test content'
      };

      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://malicious.com'
        },
        body: JSON.stringify(emailData)
      });

      const response = await worker.fetch(request, mockEnv, {} as ExecutionContext);
      const body = await response.json();
      
      expect(response.status).toBe(403);
      expect(body.error).toBe('Unauthorized origin');
    });
  });

  describe('Successful Email Sending', () => {
    it('should send email successfully with valid data', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        textContent: 'Test content',
        htmlContent: '<p>Test content</p>',
        from: 'sender@example.com'
      };

      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });

      const response = await worker.fetch(request, mockEnv, {} as ExecutionContext);
      const body = await response.json();
      
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.messageId).toBe('mock-message-id-123');
      expect(body.timestamp).toBeDefined();
    });

    it('should handle multiple recipients', async () => {
      const emailData = {
        to: ['test1@example.com', 'test2@example.com'],
        subject: 'Test Subject',
        textContent: 'Test content'
      };

      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });

      const response = await worker.fetch(request, mockEnv, {} as ExecutionContext);
      const body = await response.json();
      
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('should handle CC and BCC recipients', async () => {
      const emailData = {
        to: 'test@example.com',
        cc: 'cc@example.com',
        bcc: ['bcc1@example.com', 'bcc2@example.com'],
        subject: 'Test Subject',
        textContent: 'Test content'
      };

      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });

      const response = await worker.fetch(request, mockEnv, {} as ExecutionContext);
      const body = await response.json();
      
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('should handle attachments', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        textContent: 'Test content',
        attachments: [{
          name: 'test.txt',
          contentType: 'text/plain',
          contentInBase64: 'VGVzdCBjb250ZW50'
        }]
      };

      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });

      const response = await worker.fetch(request, mockEnv, {} as ExecutionContext);
      const body = await response.json();
      
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });
  });

  describe('Azure Configuration', () => {
    it('should initialize with connection string', async () => {
      // This test validates that the worker initializes correctly with connection string
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        textContent: 'Test content'
      };

      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });

      const response = await worker.fetch(request, mockEnv, {} as ExecutionContext);
      expect(response.status).toBe(200);
    });

    it('should initialize with service principal credentials', async () => {
      const envWithServicePrincipal = {
        AZURE_CLIENT_ID: 'mock-client-id',
        AZURE_CLIENT_SECRET: 'mock-client-secret',
        AZURE_TENANT_ID: 'mock-tenant-id',
        AZURE_COMMUNICATION_ENDPOINT: 'https://mock.communication.azure.com',
        LOG_LEVEL: 'info',
        ALLOWED_ORIGINS: '*'
      };

      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        textContent: 'Test content'
      };

      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });

      const response = await worker.fetch(request, envWithServicePrincipal, {} as ExecutionContext);
      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle Azure service errors gracefully', async () => {
      // Mock Azure client to throw an error
      vi.mocked(require('@azure/communication-email').EmailClient).mockImplementationOnce(() => ({
        beginSend: vi.fn().mockRejectedValue(new Error('Azure service error'))
      }));

      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        textContent: 'Test content'
      };

      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });

      const response = await worker.fetch(request, mockEnv, {} as ExecutionContext);
      const body = await response.json();
      
      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Azure service error');
    });

    it('should handle missing Azure configuration', async () => {
      const emptyEnv = {};

      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        textContent: 'Test content'
      };

      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });

      const response = await worker.fetch(request, emptyEnv, {} as ExecutionContext);
      const body = await response.json();
      
      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Missing required Azure Communication Services configuration');
    });
  });

  describe('Response Format', () => {
    it('should return properly formatted success response', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        textContent: 'Test content'
      };

      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });

      const response = await worker.fetch(request, mockEnv, {} as ExecutionContext);
      const body = await response.json();
      
      expect(body).toHaveProperty('success');
      expect(body).toHaveProperty('timestamp');
      expect(body.success).toBe(true);
      expect(body.messageId).toBeDefined();
      expect(new Date(body.timestamp)).toBeInstanceOf(Date);
    });

    it('should return CORS headers', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        textContent: 'Test content'
      };

      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });

      const response = await worker.fetch(request, mockEnv, {} as ExecutionContext);
      
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });
});