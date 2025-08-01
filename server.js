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

app.post('/create-order', async (req, res) => {
  const order = await razorpay.orders.create({
    amount: 5000,
    currency: 'INR',
    receipt: 'rcpt_' + Date.now()
  });
  res.json(order);
});

app.post('/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email } = req.body;
  const sig = crypto.createHmac('sha256', process.env.RAZORPAY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest('hex');
  
  if (sig !== razorpay_signature) return res.status(400).send('Invalid signature');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your eBook: Youth Ebook Rise',
    text: 'Thank you! Here is your eBook attached.',
    attachments: [{ filename: 'YouthEbookRise.pdf', path: './ebook.pdf' }]
  });

  // Redirect to thank-you page after sending email
  res.redirect('/success.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
