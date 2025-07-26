/**
 * Contract tests for Stripe API integration
 * Ensures our code matches Stripe's API contract
 */
const stripe = require('stripe')(process.env.STRIPE_TEST_SECRET_KEY);

describe('Stripe API Contract Tests', () => {
  describe('Payment Intent Contract', () => {
    it('should match expected payment intent structure', async () => {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 15000,
        currency: 'mxn',
        payment_method_types: ['card']
      });

      // Verify structure matches our expectations
      expect(paymentIntent).toMatchObject({
        id: expect.stringMatching(/^pi_/),
        object: 'payment_intent',
        amount: expect.any(Number),
        currency: 'mxn',
        status: expect.stringMatching(/^(requires_payment_method|requires_confirmation|requires_action|processing|requires_capture|canceled|succeeded)$/),
        client_secret: expect.stringMatching(/^pi_.*_secret_/),
        created: expect.any(Number),
        metadata: expect.any(Object)
      });

      // Cleanup
      await stripe.paymentIntents.cancel(paymentIntent.id);
    });

    it('should handle metadata correctly', async () => {
      const metadata = {
        application_id: '123',
        user_id: '456',
        custom_field: 'test_value'
      };

      const paymentIntent = await stripe.paymentIntents.create({
        amount: 15000,
        currency: 'mxn',
        metadata
      });

      expect(paymentIntent.metadata).toEqual(metadata);

      // Cleanup
      await stripe.paymentIntents.cancel(paymentIntent.id);
    });

    it('should handle capture method correctly', async () => {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 15000,
        currency: 'mxn',
        capture_method: 'manual'
      });

      expect(paymentIntent.capture_method).toBe('manual');

      // Confirm payment
      const confirmed = await stripe.paymentIntents.confirm(paymentIntent.id, {
        payment_method: 'pm_card_visa'
      });

      expect(confirmed.status).toBe('requires_capture');

      // Capture payment
      const captured = await stripe.paymentIntents.capture(paymentIntent.id);
      expect(captured.status).toBe('succeeded');
    });
  });

  describe('OXXO Payment Contract', () => {
    it('should create OXXO payment correctly', async () => {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 15000,
        currency: 'mxn',
        payment_method_types: ['oxxo'],
        payment_method_options: {
          oxxo: {
            expires_after_days: 3
          }
        }
      });

      expect(paymentIntent.payment_method_types).toContain('oxxo');

      // Create OXXO payment method
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'oxxo',
        billing_details: {
          name: 'Test User',
          email: 'test@example.com'
        }
      });

      // Confirm with OXXO
      const confirmed = await stripe.paymentIntents.confirm(paymentIntent.id, {
        payment_method: paymentMethod.id
      });

      expect(confirmed.status).toBe('requires_action');
      expect(confirmed.next_action).toMatchObject({
        type: 'oxxo_display_details',
        oxxo_display_details: {
          reference: expect.stringMatching(/^\d+$/),
          expires_after: expect.any(Number),
          hosted_voucher_url: expect.stringContaining('https://')
        }
      });
    });
  });

  describe('Webhook Event Contract', () => {
    it('should match expected webhook event structure', () => {
      // Mock webhook event structure
      const mockEvent = {
        id: 'evt_test_webhook',
        object: 'event',
        api_version: '2020-08-27',
        created: 1680000000,
        data: {
          object: {
            id: 'pi_test_123',
            object: 'payment_intent',
            amount: 15000,
            currency: 'mxn',
            status: 'succeeded',
            metadata: {
              application_id: '123'
            }
          }
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: 'req_test_123',
          idempotency_key: 'key_test_123'
        },
        type: 'payment_intent.succeeded'
      };

      // Verify our code expects the correct structure
      expect(mockEvent).toMatchObject({
        id: expect.any(String),
        type: expect.any(String),
        data: {
          object: expect.any(Object)
        }
      });

      // Verify we can extract the data we need
      const paymentIntent = mockEvent.data.object;
      expect(paymentIntent.metadata?.application_id).toBe('123');
      expect(paymentIntent.status).toBe('succeeded');
    });
  });

  describe('Error Handling Contract', () => {
    it('should handle Stripe errors correctly', async () => {
      try {
        await stripe.paymentIntents.create({
          amount: -100, // Invalid amount
          currency: 'mxn'
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toMatchObject({
          type: expect.any(String),
          raw: expect.objectContaining({
            code: expect.any(String),
            message: expect.any(String),
            type: expect.any(String)
          })
        });
      }
    });

    it('should handle card decline errors', async () => {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 15000,
        currency: 'mxn'
      });

      try {
        await stripe.paymentIntents.confirm(paymentIntent.id, {
          payment_method: 'pm_card_chargeDeclined'
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.code).toBe('card_declined');
        expect(error.decline_code).toBe('generic_decline');
      }
    });
  });

  describe('Customer Contract', () => {
    it('should create and retrieve customers correctly', async () => {
      const customer = await stripe.customers.create({
        email: 'test@example.com',
        name: 'Test User',
        metadata: {
          user_id: '123'
        }
      });

      expect(customer).toMatchObject({
        id: expect.stringMatching(/^cus_/),
        object: 'customer',
        email: 'test@example.com',
        name: 'Test User',
        metadata: {
          user_id: '123'
        }
      });

      // Search by email
      const customers = await stripe.customers.list({
        email: 'test@example.com'
      });

      expect(customers.data).toHaveLength(1);
      expect(customers.data[0].id).toBe(customer.id);

      // Cleanup
      await stripe.customers.del(customer.id);
    });
  });
});