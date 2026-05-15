import Stripe from 'stripe';

const stripeSecret = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';

const stripe = new Stripe(stripeSecret, {
  apiVersion: '2025-01-27.acacia' as any,
});

export const createCheckoutSession = async (params: {
  paymentId: string;
  amount: number;
  currency: string;
  propertyTitle: string;
  successUrl: string;
  cancelUrl: string;
}) => {
  return stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: {
            name: `Rent Payment: ${params.propertyTitle}`,
          },
          unit_amount: Math.round(params.amount * 100), // Stripe expects cents
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      paymentId: params.paymentId,
    },
  });
};

export const verifyWebhookSignature = (payload: string | Buffer, signature: string, secret: string) => {
  return stripe.webhooks.constructEvent(payload, signature, secret);
};

export default stripe;
