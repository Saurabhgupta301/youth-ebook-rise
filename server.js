const express = require('express');
const Razorpay = require('razorpay');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { Resend } = require('resend');
require('dotenv').config();

const app = express();
app.use(express.static('.'));
app.use(bodyParser.json());

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET
});

const resend = new Resend(process.env.RESEND_API_KEY);

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

// ✅ Verify payment manually (optional fallback)
app.post('/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email } = req.body;
  const sig = crypto.createHmac('sha256', process.env.RAZORPAY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest('hex');

  if (sig !== razorpay_signature) return res.status(400).send('Invalid signature');

  // Store email temporarily for success.html
  res.json({ success: true });
});

// ✅ Send ebook email
app.post('/send-ebook', async (req, res) => {
  const { email } = req.body;
  try {
    const data = await resend.emails.send({
      from: 'onboarding@resend.dev', // ✅ Temporary working sender
      to: email,
      subject: 'Your Youth E-Book – 1 Crore in 365 Days',
      html: `
        <p>Hi 👋</p>
        <p>Thank you for purchasing the Youth E-Book Rise 🎉</p>
        <a href="https://youth-ebook-rise.onrender.com/ebook.pdf" 
           style="display:inline-block;padding:10px 20px;background:#ff1493;color:#fff;text-decoration:none;border-radius:5px;">
           📥 Download eBook
        </a>
        <p>Happy learning,<br>Team Youth E-Book Rise</p>
      `,
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Email send error:", error);
    res.status(500).json({ success: false, error });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
