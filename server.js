const express = require('express');
const Razorpay = require('razorpay');
const bodyParser = require('body-parser');
const crypto = require('crypto');
require('dotenv').config();
const path = require('path');

const app = express();
app.use(express.static('.')); // Serves static files like success.html and ebook.pdf
app.use(bodyParser.json());

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET
});

// ✅ Create Razorpay order
app.post('/create-order', async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: 4900, // ₹49
      currency: 'INR',
      receipt: 'rcpt_' + Date.now()
    });
    res.json(order);
  } catch (error) {
    console.error('❌ Error creating order:', error);
    res.status(500).send('Error creating order');
  }
});

// ✅ Verify payment and redirect only if captured
app.post('/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    console.warn('❌ Invalid signature');
    return res.status(400).send('Invalid signature');
  }

  try {
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (payment.status === 'captured') {
      // ✅ Legit payment, redirect with payment ID
      res.redirect(`/success.html?payment_id=${razorpay_payment_id}`);
    } else {
      console.warn('❌ Payment not captured:', payment.status);
      res.status(400).send('Payment not captured');
    }
  } catch (err) {
    console.error('❌ Error verifying payment:', err);
    res.status(500).send('Verification failed');
  }
});

// ✅ Secure download route (verifies payment before sending file)
app.get('/download', async (req, res) => {
  const paymentId = req.query.payment_id;
  if (!paymentId) return res.status(400).send('Missing payment ID');

  try {
    const payment = await razorpay.payments.fetch(paymentId);
    if (payment.status === 'captured') {
      const filePath = path.join(__dirname, 'ebook.pdf');
      res.download(filePath, 'Youth-Ebook-Rise.pdf');
    } else {
      res.status(403).send('Payment not captured. Download denied.');
    }
  } catch (err) {
    console.error('❌ Error verifying payment for download:', err);
    res.status(500).send('Unable to verify payment');
  }
});

// ✅ Webhook for Razorpay (optional use)
app.post('/razorpay/webhook', (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];

  const expectedSignature = crypto.createHmac('sha256', webhookSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (signature === expectedSignature) {
    console.log('✅ Webhook verified:', req.body);

    if (req.body.event === 'payment.captured') {
      const paymentId = req.body.payload.payment.entity.id;
      console.log('💰 Webhook payment captured:', paymentId);
      // Optional: Send email, log DB, etc.
    }

    res.status(200).json({ status: 'ok' });
  } else {
    console.warn('❌ Webhook signature mismatch');
    res.status(400).json({ status: 'invalid signature' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
