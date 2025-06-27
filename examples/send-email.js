// Example 1: Basic email sending
async function sendBasicEmail() {
  const response = await fetch('https://your-worker.your-subdomain.workers.dev', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: 'recipient@example.com',
      subject: 'Hello from Cloudflare Worker!',
      htmlContent: '<h1>Hello World!</h1><p>This email was sent from a Cloudflare Worker using Azure Communication Services.</p>',
      textContent: 'Hello World!\n\nThis email was sent from a Cloudflare Worker using Azure Communication Services.',
      from: 'sender@your-domain.com'
    })
  });

  const result = await response.json();
  console.log('Email sent:', result);
}

// Example 2: Email with multiple recipients and attachments
async function sendAdvancedEmail() {
  const response = await fetch('https://your-worker.your-subdomain.workers.dev', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: ['recipient1@example.com', 'recipient2@example.com'],
      cc: ['cc@example.com'],
      bcc: ['bcc@example.com'],
      subject: 'Advanced Email Example',
      htmlContent: `
        <html>
          <body>
            <h2>Advanced Email Example</h2>
            <p>This email demonstrates:</p>
            <ul>
              <li>Multiple recipients</li>
              <li>CC and BCC</li>
              <li>HTML content</li>
              <li>Attachments</li>
            </ul>
            <p>Best regards,<br>Your Cloudflare Worker</p>
          </body>
        </html>
      `,
      textContent: 'Advanced Email Example\n\nThis email demonstrates multiple recipients, CC/BCC, and attachments.\n\nBest regards,\nYour Cloudflare Worker',
      from: 'sender@your-domain.com',
      replyTo: 'noreply@your-domain.com',
      attachments: [
        {
          name: 'example.txt',
          contentType: 'text/plain',
          contentInBase64: btoa('This is a sample text file attachment.')
        }
      ]
    })
  });

  const result = await response.json();
  console.log('Advanced email sent:', result);
}

// Example 3: Error handling
async function sendEmailWithErrorHandling() {
  try {
    const response = await fetch('https://your-worker.your-subdomain.workers.dev', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: 'invalid-email', // This will cause a validation error
        subject: 'Test Email',
        textContent: 'This is a test email.'
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('Email sent successfully:', result.messageId);
    } else {
      console.error('Failed to send email:', result.error);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
}

// Example 4: Using with React/Next.js
async function sendEmailFromReact(emailData) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSendEmail = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData)
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error sending email:', error);
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return { handleSendEmail, loading, result };
}

// Example 5: Bulk email sending with rate limiting
async function sendBulkEmails(emailList) {
  const results = [];
  const batchSize = 5; // Send 5 emails at a time
  const delay = 1000; // 1 second delay between batches

  for (let i = 0; i < emailList.length; i += batchSize) {
    const batch = emailList.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (emailData) => {
      const response = await fetch('https://your-worker.your-subdomain.workers.dev', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData)
      });
      return response.json();
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Wait before sending next batch
    if (i + batchSize < emailList.length) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return results;
}

// Example usage
if (typeof window !== 'undefined') {
  // Browser environment
  document.addEventListener('DOMContentLoaded', () => {
    sendBasicEmail();
  });
} else {
  // Node.js environment
  sendBasicEmail().catch(console.error);
}