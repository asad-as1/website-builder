const router = require('express').Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const prisma = require('../../shared/prisma/prisma.client');
const { authenticate } = require('../auth/auth.middleware');

const plans = {
  starter: { amount: 50000, requests: 500 },
  growth: { amount: 100000, requests: 1000 },
  pro: { amount: 150000, requests: 1500 },
  business: { amount: 250000, requests: 5000 },
  scale: { amount: 500000, requests: 15000 },
};

const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    // Return null to indicate payments are not configured. Handlers will respond in test-mode.
    return null;
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

router.post('/create-order', authenticate, async (req, res) => {
  try {
    const plan = plans[req.body.plan];
    const planId = req.body.plan;
    if (!plan) return res.status(400).json({ error: 'Invalid plan' });
    const razorpay = getRazorpay();
    if (!razorpay) {
      // Test-mode response so frontend can handle absence of credentials gracefully
      return res.json({
        testMode: true,
        order: { id: `test_${Date.now()}`, amount: plan.amount, currency: 'INR' },
        keyId: null,
        message: 'Payments are not configured on the backend. This is a test-mode response.'
      });
    }
    const order = await razorpay.orders.create({
      amount: plan.amount,
      currency: 'INR',
      receipt: `genetix_${req.userId}_${Date.now()}`,
      notes: { userId: req.userId, plan: planId },
    });
    res.json({
      order,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

router.post('/verify', authenticate, async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;
    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Payment verification fields are required' });
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      // If secret missing, treat this as a test-mode verification and activate plan locally
      const selectedPlan = plans[req.body.plan] ? req.body.plan : 'starter';
      await prisma.user.update({ where: { id: req.userId }, data: { plan: selectedPlan } });
      return res.json({ message: 'Subscription activated (test mode)', plan: selectedPlan, testMode: true });
    }

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }
    const razorpay = getRazorpay();
    const order = await razorpay.orders.fetch(orderId);
    const selectedPlan = order.notes?.plan;
    if (!selectedPlan || !plans[selectedPlan]) {
      return res.status(400).json({ error: 'Payment order does not contain a valid plan' });
    }
    await prisma.user.update({ where: { id: req.userId }, data: { plan: selectedPlan } });
    res.json({ message: 'Subscription activated', plan: selectedPlan });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    if (!secret || !signature) {
      // Make webhook endpoint safe to call even when not configured
      return res.json({ received: true, testMode: true, message: 'Webhook not configured' });
    }
    const expected = crypto.createHmac('sha256', secret).update(req.rawBody || Buffer.from(JSON.stringify(req.body))).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }
    const userId = req.body?.payload?.order?.entity?.notes?.userId;
    if (userId && req.body.event === 'payment.captured') {
      const selectedPlan = req.body.payload?.order?.entity?.notes?.plan;
      if (plans[selectedPlan]) {
        await prisma.user.update({ where: { id: userId }, data: { plan: selectedPlan } });
      }
    }
    res.json({ received: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
