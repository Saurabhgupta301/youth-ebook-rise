const express = require('express');
const Razorpay = require('razorpay');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const path = require('path');
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

  await sendEbookEmail(email);
  res.redirect('/success.html');
});

// ✅ Webhook for automatic email sending
app.post('/webhook', express.json(), (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];

  console.log("🔔 Webhook Event:", req.body.event);
  console.log("📦 Payload:", JSON.stringify(req.body, null, 2));

  const shasum = crypto.createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (shasum === signature) {
    console.log("✅ Webhook signature verified");

    switch (req.body.event) {
      case 'payment.captured': {
        const email = req.body.payload.payment.entity.email;
        if (email) {
          console.log(`💰 Payment captured. Attempting to send ebook to: ${email}`);
          sendEbookEmail(email)
            .then(() => console.log("✅ Email sent successfully"))
            .catch(err => console.error("❌ Email sending failed:", err));
        } else {
          console.warn("⚠️ No email found in payment payload");
        }
        break;
      }

      case 'order.notification.delivered':
        console.log("📩 Notification delivered successfully");
        break;

      case 'order.notification.failed': {
        console.warn("⚠️ Notification delivery failed");
        sendEbookEmail('admin@example.com')
          .catch(err => console.error("❌ Admin alert email failed:", err));
        break;
      }

      default:
        console.log("ℹ️ Unhandled event:", req.body.event);
    }

    res.status(200).json({ status: 'ok' });
  } else {
    console.warn("❌ Invalid webhook signature");
    res.status(400).send('Invalid signature');
  }
});

// ✅ Test email route
app.get('/test-email', async (req, res) => {
  try {
    const testEmail = "100rabhgupta301@gmail.com"; 
    await sendEbookEmail(testEmail);
    console.log(`✅ Test email sent to: ${testEmail}`);
    res.send(`✅ Test email sent to ${testEmail}`);
  } catch (err) {
    console.error("❌ Test email sending failed:", err);
    res.status(500).send("❌ Test email sending failed. Check logs for details.");
  }
});

// ✅ Reusable function to send eBook via email
async function sendEbookEmail(toEmail) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { 
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS 
      }
    });

    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: toEmail,
      subject: 'Your eBook: Youth Ebook Rise',
      text: 'Thank you for your purchase! Please find your eBook attached.',
      attachments: [
        {
          filename: 'YouthEbookRise.pdf',
          path: path.join(__dirname, 'ebook.pdf'),
          contentType: 'application/pdf'
        }
      ]
    });

    console.log("✅ Email sent:", info.response);
  } catch (error) {
    console.error("❌ Email sending error:", error);
    throw error;
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
