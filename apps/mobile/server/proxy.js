require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const cors = require('cors');

const stripe = process.env.STRIPE_SECRET_KEY
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : null;

const app = express();
const PORT = 3001;

const corsOptions = {
  origin: function (origin, callback) {
    if (
      !origin ||
      origin.startsWith('http://localhost') ||
      origin.includes('vercel.app') ||
      origin.includes('railway.app') ||
      origin.includes('clearpass')
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));

// Webhook must be registered before express.json() to receive the raw body
// needed for Stripe signature verification.
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[webhook] signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    console.log('[webhook] checkout.session.completed userId:', userId);

    if (userId) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabaseAdmin = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_KEY,
        );

        const { data } = await supabaseAdmin
          .from('user_progress')
          .select('progress')
          .eq('id', userId)
          .single();

        const existing = data?.progress ?? {};
        const { error } = await supabaseAdmin.from('user_progress').upsert(
          {
            id: userId,
            progress: { ...existing, isPro: true },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' },
        );
        console.log('[webhook] isPro upsert:', error ?? 'ok');
      } catch (e) {
        console.error('[webhook] Supabase error:', e);
      }
    }
  }

  res.json({ received: true });
});

app.use(express.json());

app.post('/api/explain', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in server/.env' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(502).json({ error: 'Failed to reach Anthropic API', detail: String(err) });
  }
});

app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY not set' });
  }

  const { userId } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: 'price_1TSxHQHuKtBOOS4sfJnZye1R', quantity: 1 }],
      mode: 'payment',
      success_url: 'https://clearpass-app.vercel.app/payment-success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://clearpass-app.vercel.app/landing',
      metadata: { userId: userId ?? '' },
      currency: 'gbp',
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session', detail: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`ClearPass proxy running on http://localhost:${PORT}`);
});
