const express = require('express');
const Razorpay = require('razorpay');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.static('.')); // Serves ebook.pdf and success.html
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

// ✅ Verify payment and redirect to success page
app.post('/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const sig = crypto.createHmac('sha256', process.env.RAZORPAY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest('hex');

  if (sig !== razorpay_signature) return res.status(400).send('Invalid signature');

  // Redirect with payment_id
  res.redirect(`/success.html?payment_id=${razorpay_payment_id}`);
});

// ✅ Secure download route (with payment verification)
app.get('/download', async (req, res) => {
  try {
    const paymentId = req.query.payment_id;
    if (!paymentId) return res.status(400).send('Missing payment ID');

    // Fetch payment details from Razorpay API
    const payment = await razorpay.payments.fetch(paymentId);

    if (payment.status === 'captured') {
      const filePath = path.join(__dirname, 'ebook.pdf');
      res.download(filePath, 'Youth-Ebook-Rise.pdf');
    } else {
      res.status(403).send('Payment not verified yet. Please contact support.');
    }
  } catch (error) {
    console.error('❌ Download verification error:', error);
    res.status(500).send('Error verifying payment');
  }
});

// ✅ Webhook endpoint
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
      console.log('💰 Payment captured:', paymentId);

      // 👉 TODO: send email with download link
    }

    res.status(200).json({ status: 'ok' });
  } else {
    console.warn('❌ Webhook signature mismatch');
    res.status(400).json({ status: 'invalid signature' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
