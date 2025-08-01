const express = require('express');
const Razorpay = require('razorpay');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(express.static('.'));
app.use(bodyParser.json());

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET
});

// ✅ Create Razorpay order
app.post('/create-order', async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: 4900, // ₹49 in paise
      currency: 'INR',
      receipt: 'rcpt_' + Date.now()
    });
    res.json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).send('Error creating order');
  }
});

// ✅ Verify payment manually (optional fallback)
app.post('/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email } = req.body;
  const sig = crypto.createHmac('sha256', process.env.RAZORPAY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest('hex');

  if (sig !== razorpay_signature) return res.status(400).send('Invalid signature');

  await sendEbookEmail(email);
  res.redirect('/success.html');
});

// ✅ Webhook for automatic email sending
app.post('/webhook', bodyParser.json(), async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  const shasum = crypto.createHmac('sha256', secret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest('hex');

  if (digest !== req.headers['x-razorpay-signature']) {
    return res.status(400).send('Invalid signature');
  }

  // Handle successful payment
  if (req.body.event === 'payment.captured') {
    const paymentData = req.body.payload.payment.entity;
    const customerEmail = paymentData.email;

    if (customerEmail) {
      await sendEbookEmail(customerEmail);
      console.log(`✅ Email sent successfully to ${customerEmail}`);
    } else {
      console.warn('⚠️ No email found in payment data.');
    }
  }

  res.status(200).json({ status: 'success' });
});

// ✅ Reusable function to send eBook via email
async function sendEbookEmail(toEmail) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: 'Your eBook: Youth Ebook Rise',
    text: 'Thank you for your purchase! Please find your eBook attached.',
    attachments: [
      {
        filename: 'YouthEbookRise.pdf',
        path: './ebook.pdf'
      }
    ]
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
