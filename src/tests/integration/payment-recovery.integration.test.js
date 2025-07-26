/**
 * Integration tests for payment recovery system
 * Uses Stripe test mode to simulate real payment scenarios
 */
const request = require('supertest');
const app = require('../../server');
const db = require('../../db');
const stripe = require('stripe')(process.env.STRIPE_TEST_SECRET_KEY);
const paymentRecoveryService = require('../../services/payment-recovery.service');
const { ApplicationStatus } = require('../../constants');

describe('Payment Recovery Integration Tests', () => {
  let testUser;
  let testApplication;
  let authToken;

  beforeAll(async () => {
    // Clean up test data
    await db.query('DELETE FROM payment_recovery_attempts WHERE application_id < 1000');
    await db.query('DELETE FROM payment_events WHERE application_id < 1000');
    await db.query('DELETE FROM webhook_events WHERE event_id LIKE $1', ['evt_test_%']);
  });

  beforeEach(async () => {
    // Create test user and application
    const userResult = await db.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, email_verified)
      VALUES ($1, $2, $3, $4, true)
      RETURNING *
    `, ['test@example.com', 'hashed_password', 'Test', 'User']);
    testUser = userResult.rows[0];

    const appResult = await db.query(`
      INSERT INTO permit_applications (
        user_id, status, nombre_completo, curp_rfc, domicilio,
        marca, linea, color, numero_serie, numero_motor, ano_modelo, importe
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      testUser.id, ApplicationStatus.PAYMENT_PROCESSING, 'Test User', 'CURP123456',
      'Test Address', 'Toyota', 'Corolla', 'Red', 'VIN123', 'ENGINE123', 2020, 150
    ]);
    testApplication = appResult.rows[0];

    // Get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password' });
    authToken = loginResponse.body.data.token;
  });

  afterEach(async () => {
    // Clean up test data
    if (testApplication) {
      await db.query('DELETE FROM permit_applications WHERE id = $1', [testApplication.id]);
    }
    if (testUser) {
      await db.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    }
  });

  describe('Payment Recovery Scenarios', () => {
    it('should recover a succeeded payment that appears failed locally', async () => {
      // Create a payment intent in Stripe
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 15000,
        currency: 'mxn',
        payment_method_types: ['card'],
        metadata: {
          application_id: testApplication.id.toString(),
          user_id: testUser.id.toString()
        }
      });

      // Update local status to failed
      await db.query(`
        UPDATE permit_applications 
        SET status = $1, payment_processor_order_id = $2
        WHERE id = $3
      `, [ApplicationStatus.PAYMENT_FAILED, paymentIntent.id, testApplication.id]);

      // Manually confirm payment in Stripe (simulating successful payment)
      await stripe.paymentIntents.confirm(paymentIntent.id, {
        payment_method: 'pm_card_visa'
      });

      // Attempt recovery
      const result = await paymentRecoveryService.attemptPaymentRecovery(
        testApplication.id,
        paymentIntent.id,
        { message: 'Integration test recovery' }
      );

      expect(result.success).toBe(true);
      expect(result.reason).toBe('payment_succeeded');

      // Verify database was updated
      const updatedApp = await db.query(
        'SELECT status FROM permit_applications WHERE id = $1',
        [testApplication.id]
      );
      expect(updatedApp.rows[0].status).toBe(ApplicationStatus.PAYMENT_PROCESSING);
    });

    it('should handle requires_capture scenario', async () => {
      // Create a payment intent with manual capture
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 15000,
        currency: 'mxn',
        payment_method_types: ['card'],
        capture_method: 'manual',
        metadata: {
          application_id: testApplication.id.toString(),
          user_id: testUser.id.toString()
        }
      });

      // Confirm payment (will go to requires_capture)
      await stripe.paymentIntents.confirm(paymentIntent.id, {
        payment_method: 'pm_card_visa'
      });

      // Update application to approved status
      await db.query(
        'UPDATE permit_applications SET status = $1, payment_processor_order_id = $2 WHERE id = $3',
        [ApplicationStatus.APPROVED, paymentIntent.id, testApplication.id]
      );

      // Attempt recovery - should auto-capture
      const result = await paymentRecoveryService.attemptPaymentRecovery(
        testApplication.id,
        paymentIntent.id,
        { message: 'Test auto-capture' }
      );

      expect(result.success).toBe(true);
      expect(result.reason).toBe('payment_succeeded');

      // Verify payment was captured in Stripe
      const updatedIntent = await stripe.paymentIntents.retrieve(paymentIntent.id);
      expect(updatedIntent.status).toBe('succeeded');
    });

    it('should handle OXXO payment confirmation', async () => {
      // Create OXXO payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 15000,
        currency: 'mxn',
        payment_method_types: ['oxxo'],
        payment_method_options: {
          oxxo: {
            expires_after_days: 3
          }
        },
        metadata: {
          application_id: testApplication.id.toString(),
          user_id: testUser.id.toString()
        }
      });

      // Confirm with OXXO payment method
      const confirmedIntent = await stripe.paymentIntents.confirm(paymentIntent.id, {
        payment_method: {
          type: 'oxxo',
          billing_details: {
            name: 'Test User',
            email: 'test@example.com'
          }
        }
      });

      // Update application status
      await db.query(
        'UPDATE permit_applications SET status = $1, payment_processor_order_id = $2 WHERE id = $3',
        [ApplicationStatus.AWAITING_OXXO_PAYMENT, paymentIntent.id, testApplication.id]
      );

      // Simulate OXXO payment webhook
      const webhookPayload = {
        id: 'evt_test_oxxo',
        type: 'charge.succeeded',
        data: {
          object: {
            id: 'ch_test_oxxo',
            payment_intent: paymentIntent.id,
            payment_method_details: {
              type: 'oxxo'
            },
            paid: true,
            status: 'succeeded'
          }
        }
      };

      // Process webhook
      await request(app)
        .post('/api/payments/stripe/webhook')
        .set('stripe-signature', generateTestWebhookSignature(webhookPayload))
        .send(webhookPayload)
        .expect(200);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify application was updated
      const updatedApp = await db.query(
        'SELECT status FROM permit_applications WHERE id = $1',
        [testApplication.id]
      );
      expect(updatedApp.rows[0].status).toBe(ApplicationStatus.PAYMENT_RECEIVED);
    });
  });

  describe('Reconciliation Job', () => {
    it('should reconcile stuck payments', async () => {
      // Create multiple stuck payments
      const stuckApplications = [];
      for (let i = 0; i < 3; i++) {
        const appResult = await db.query(`
          INSERT INTO permit_applications (
            user_id, status, payment_processor_order_id, nombre_completo, 
            curp_rfc, domicilio, marca, linea, color, numero_serie, 
            numero_motor, ano_modelo, importe, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW() - INTERVAL '2 hours')
          RETURNING *
        `, [
          testUser.id, ApplicationStatus.PAYMENT_PROCESSING, `pi_stuck_${i}`,
          'Test User', 'CURP123456', 'Test Address', 'Toyota', 'Corolla',
          'Red', `VIN${i}`, `ENGINE${i}`, 2020, 150
        ]);
        stuckApplications.push(appResult.rows[0]);
      }

      // Run reconciliation job
      const { reconcileStuckPayments } = require('../../jobs/payment-reconciliation');
      const result = await reconcileStuckPayments();

      expect(result.processed).toBeGreaterThanOrEqual(3);
      
      // Clean up
      for (const app of stuckApplications) {
        await db.query('DELETE FROM permit_applications WHERE id = $1', [app.id]);
      }
    });
  });

  describe('Velocity Checks', () => {
    it('should block rapid-fire payment attempts', async () => {
      const velocityService = require('../../services/payment-velocity.service');
      
      // Simulate multiple rapid attempts
      for (let i = 0; i < 6; i++) {
        const velocityCheck = await velocityService.checkPaymentVelocity({
          userId: testUser.id,
          email: testUser.email,
          ipAddress: '192.168.1.1',
          amount: 150,
          cardLast4: '4242',
          cardFingerprint: 'card_fingerprint_123'
        });

        if (i < 5) {
          expect(velocityCheck.allowed).toBe(true);
        } else {
          // 6th attempt should be blocked
          expect(velocityCheck.allowed).toBe(false);
          expect(velocityCheck.violations).toContainEqual(
            expect.objectContaining({
              type: 'user_hourly_limit'
            })
          );
        }
      }

      // Reset velocity for cleanup
      await velocityService.resetUserVelocity(testUser.id);
    });
  });
});

// Helper function to generate test webhook signature
function generateTestWebhookSignature(payload) {
  const crypto = require('crypto');
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadString = JSON.stringify(payload);
  const signedPayload = `${timestamp}.${payloadString}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET)
    .update(signedPayload, 'utf8')
    .digest('hex');
  return `t=${timestamp},v1=${expectedSignature}`;
}