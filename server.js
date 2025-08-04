const express = require('express');
const Razorpay = require('razorpay');
const bodyParser = require('body-parser');
const crypto = require('crypto');
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

// ✅ Secure download route
app.get('/download', (req, res) => {
  const paymentId = req.query.payment_id;

  // Basic check: make sure paymentId exists
  if (!paymentId) return res.status(400).send('Missing payment ID');

  // TODO: Optionally verify payment status via Razorpay API before download

  const filePath = __dirname + '/ebook.pdf';
  res.download(filePath, 'Youth-Ebook-Rise.pdf');
});


// ✅ Webhook endpoint (NEW)
app.post('/razorpay/webhook', (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET; // set this in .env
  const signature = req.headers['x-razorpay-signature'];

  const expectedSignature = crypto.createHmac('sha256', webhookSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (signature === expectedSignature) {
    console.log('✅ Webhook verified:', req.body);

    // Handle different event types
    if (req.body.event === 'payment.captured') {
      console.log('💰 Payment captured:', req.body.payload.payment.entity.id);
      // 👉 TODO: Send eBook download email or grant access
    }

    res.status(200).json({ status: 'ok' });
  } else {
    console.warn('❌ Webhook signature mismatch');
    res.status(400).json({ status: 'invalid signature' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
