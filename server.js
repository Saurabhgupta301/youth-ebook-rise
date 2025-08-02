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
app.post('/webhook', express.json(), (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    // Log everything for debugging
    console.log("🔔 Webhook Event:", req.body.event);
    console.log("📦 Payload:", JSON.stringify(req.body, null, 2));

    // Verify signature
    const shasum = crypto.createHmac('sha256', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');

    if (shasum === signature) {
        console.log("✅ Webhook signature verified");

        switch (req.body.event) {
    case 'payment.captured': {
        const email = req.body.payload.payment.entity.email;
        if (email) {
            console.log(`💰 Payment captured. Sending ebook to: ${email}`);
            sendEmailWithAttachment(email);
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
        sendEmailWithAttachment(
            'admin@example.com',
            'Webhook Delivery Failed',
            'A Razorpay notification failed to deliver. Check logs.'
        );
        break;
    }

    default:
        console.log("ℹ️ Unhandled event:", req.body.event);
}


            case 'order.notification.delivered':
                console.log("📩 Notification delivered successfully");
                break;

            case 'order.notification.failed': {
                console.warn("⚠️ Notification delivery failed");
                sendEmailWithAttachment(
                    'admin@example.com',
                    'Webhook Delivery Failed',
                    'A Razorpay notification failed to deliver. Check logs.'
                );
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
