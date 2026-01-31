# Backend Integration Guide

This document provides instructions for integrating the frontend with backend APIs for email, payments, and shipping.

## Overview

The frontend application includes integration points for:
1. **Email Service** - Order confirmations via SendGrid/AWS SES/Resend
2. **PayPay API** - Payment processing
3. **Carrier APIs** - Shipping label generation (Japan Post, Yamato, Sagawa)
4. **WhatsApp Business API** - Order notifications

## Environment Setup

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Fill in your API credentials in `.env`

## 1. Email Service Integration

### Recommended Services
- **SendGrid** - https://sendgrid.com/
- **AWS SES** - https://aws.amazon.com/ses/
- **Resend** - https://resend.com/

### Backend Implementation Example (Node.js + SendGrid)

```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.post('/api/send-email', async (req, res) => {
  const { to, subject, html, orderNumber, customerName } = req.body;
  
  const msg = {
    to: to,
    from: {
      email: 'noreply@docedeleite.jp',
      name: 'Doce de Leite'
    },
    subject: subject,
    html: html,
  };
  
  try {
    await sgMail.send(msg);
    console.log(`Email sent to ${to} for order ${orderNumber}`);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Testing
```bash
curl -X POST http://localhost:3001/api/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "customer@example.com",
    "subject": "Test Order Confirmation",
    "html": "<h1>Order Confirmed</h1>",
    "orderNumber": "DL-12345678",
    "customerName": "Test Customer"
  }'
```

## 2. PayPay API Integration

### Setup
1. Register at https://developer.paypay.ne.jp/
2. Get API credentials (Client ID, Secret, Merchant ID)
3. Start with sandbox environment

### Backend Implementation (Node.js)

```javascript
const paypay = require('@paypayopa/paypayopa-sdk-node');

// Configure PayPay
paypay.Configure({
  clientId: process.env.PAYPAY_API_KEY,
  clientSecret: process.env.PAYPAY_API_SECRET,
  merchantId: process.env.PAYPAY_MERCHANT_ID,
  productionMode: false // true for production
});

app.post('/api/paypay/create-payment', async (req, res) => {
  const { orderNumber, amount, description, customerEmail } = req.body;
  
  const payload = {
    merchantPaymentId: orderNumber,
    amount: {
      amount: amount,
      currency: 'JPY'
    },
    orderDescription: description,
    // For web integration:
    orderItems: req.body.items,
    // Redirect URLs
    userAuthorizationId: req.body.userAuthorizationId
  };
  
  try {
    const response = await paypay.QRCodeCreate(payload);
    console.log('PayPay payment created:', response);
    
    res.json({
      success: true,
      paymentUrl: response.RESULT.url,
      qrCodeUrl: response.RESULT.data.codeId,
      paymentId: orderNumber
    });
  } catch (error) {
    console.error('PayPay error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check payment status
app.get('/api/paypay/status/:paymentId', async (req, res) => {
  try {
    const response = await paypay.GetPaymentDetails(req.params.paymentId);
    res.json({
      status: response.RESULT.status,
      paid: response.RESULT.status === 'COMPLETED'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Webhook Handling
```javascript
app.post('/api/paypay/webhook', (req, res) => {
  // Verify webhook signature
  const signature = req.headers['x-paypay-signature'];
  // ... verify signature ...
  
  const event = req.body;
  if (event.status === 'COMPLETED') {
    // Update order status in database
    console.log('Payment completed for order:', event.merchantPaymentId);
  }
  
  res.json({ received: true });
});
```

## 3. Carrier API Integration

### Japan Post (ゆうパック)

```javascript
const axios = require('axios');

app.post('/api/carriers/japan-post/create-label', async (req, res) => {
  const { orderNumber, sender, recipient, items } = req.body;
  
  try {
    const response = await axios.post('https://api.post.japanpost.jp/v1/shipments', {
      customerCode: process.env.JAPAN_POST_CUSTOMER_CODE,
      shipment: {
        reference: orderNumber,
        sender: {
          name: sender.name,
          postalCode: sender.postalCode,
          address: sender.address,
          phone: sender.phone
        },
        recipient: {
          name: recipient.name,
          postalCode: recipient.postalCode,
          address: `${recipient.prefecture} ${recipient.city} ${recipient.address}`,
          phone: recipient.phone
        },
        parcels: items.map(item => ({
          weight: item.weight,
          description: item.name
        }))
      }
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.JAPAN_POST_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    res.json({
      trackingNumber: response.data.trackingNumber,
      carrier: 'Japan Post',
      status: 'label_created',
      labelUrl: response.data.labelUrl
    });
  } catch (error) {
    console.error('Japan Post error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### Yamato Transport (クロネコヤマト)

**Note:** Yamato requires a business contract. Contact Yamato Business Support:
- Website: https://www.kuronekoyamato.co.jp/ytc/business/
- Phone: 0120-01-9625

```javascript
app.post('/api/carriers/yamato/create-label', async (req, res) => {
  // Similar implementation after obtaining Yamato API credentials
  // API endpoint and authentication method provided by Yamato
});
```

### Sagawa Express (佐川急便)

**Note:** Sagawa requires a business contract. Contact:
- Website: https://www.sagawa-exp.co.jp/service/
- Phone: 0120-189-595

```javascript
app.post('/api/carriers/sagawa/create-label', async (req, res) => {
  // Similar implementation after obtaining Sagawa API credentials
});
```

## 4. WhatsApp Business API

### Setup
1. Register at https://business.whatsapp.com/
2. Get API credentials from Meta Business
3. Set up phone number (070-1367-1679)

### Backend Implementation

```javascript
const axios = require('axios');

app.post('/api/whatsapp/send', async (req, res) => {
  const { to, message } = req.body;
  
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: {
          body: message
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('WhatsApp message sent:', response.data);
    res.json({ success: true, messageId: response.data.messages[0].id });
  } catch (error) {
    console.error('WhatsApp error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

## 5. Complete Backend Server Example

### Express.js Server Setup

```javascript
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Import all API routes
app.use('/api', require('./routes/email'));
app.use('/api/paypay', require('./routes/paypay'));
app.use('/api/carriers', require('./routes/carriers'));
app.use('/api/whatsapp', require('./routes/whatsapp'));

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
```

### Frontend Configuration

Update `.env` in frontend:
```bash
VITE_API_URL=http://localhost:3001/api
```

Then in frontend services, uncomment the API calls:
```javascript
// In src/services/emailService.ts
const response = await fetch(`${import.meta.env.VITE_API_URL}/send-email`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
```

## Testing

### 1. Test Email Service
```bash
npm run test:email
```

### 2. Test PayPay (Sandbox)
```bash
npm run test:paypay
```

### 3. Test Shipping Labels
```bash
npm run test:carriers
```

## Production Deployment

### Checklist
- [ ] All API keys configured in production `.env`
- [ ] PayPay switched to production mode
- [ ] Email service configured with production domain
- [ ] SSL certificates installed
- [ ] CORS configured for production domain
- [ ] Rate limiting implemented
- [ ] Logging and monitoring set up
- [ ] Error handling and alerting
- [ ] Backup strategy for orders database

### Security Recommendations
1. Never commit `.env` file
2. Use environment variables for all credentials
3. Implement API rate limiting
4. Validate all inputs
5. Use HTTPS only
6. Implement webhook signature verification
7. Log all transactions
8. Regular security audits

## Support

For issues with:
- **Email**: Check SendGrid/AWS SES logs
- **PayPay**: Contact developer.paypay.ne.jp
- **Carriers**: Contact respective carrier support
- **WhatsApp**: Check Meta Business Suite

## Additional Resources

- [SendGrid Documentation](https://docs.sendgrid.com/)
- [PayPay Developer Portal](https://developer.paypay.ne.jp/)
- [Japan Post Web Service](https://www.post.japanpost.jp/service/webservice/)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
