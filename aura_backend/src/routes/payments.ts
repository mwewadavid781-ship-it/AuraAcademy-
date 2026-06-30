/**
 * MTN MOBILE MONEY INTEGRATION
 * Sandbox Mode + Production Ready
 * 
 * Endpoints:
 * - POST /api/v1/payments/mtn/initiate - Start payment request
 * - POST /api/v1/payments/mtn/confirm - Confirm payment
 * - GET /api/v1/payments/mtn/status/:referenceId - Check payment status
 * - POST /api/v1/payments/mtn/webhook - MTN callback webhook
 */

import express, { Router, Request, Response } from "express";
import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import { supabase, logger } from "./server";
import { z } from "zod";

const router = Router();

// ===== TYPES =====
interface MTNConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  subscriptionKey: string;
  callbackUrl: string;
  primaryKey: string;
}

interface PaymentInitRequest {
  mtn_msisdn: string;
  amount: number;
  studentId: string;
  subscriptionId: string;
}

interface MTNResponse {
  status: string;
  message?: string;
  transactionId?: string;
  referenceId?: string;
}

// ===== MTN CONFIGURATION =====
const getMTNConfig = (): MTNConfig => {
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev || process.env.MTN_SANDBOX_MODE === "true") {
    // SANDBOX CONFIGURATION
    return {
      apiKey: process.env.MTN_SANDBOX_API_KEY || "sandbox-api-key",
      apiSecret: process.env.MTN_SANDBOX_API_SECRET || "sandbox-secret",
      baseUrl: "https://sandbox.momoapi.mtn.com",
      subscriptionKey: process.env.MTN_SANDBOX_SUBSCRIPTION_KEY || "sandbox-subscription",
      callbackUrl: `${process.env.BACKEND_URL}/api/v1/payments/mtn/webhook`,
      primaryKey: process.env.MTN_SANDBOX_PRIMARY_KEY || "sandbox-primary",
    };
  }

  // PRODUCTION CONFIGURATION
  return {
    apiKey: process.env.MTN_PRODUCTION_API_KEY!,
    apiSecret: process.env.MTN_PRODUCTION_API_SECRET!,
    baseUrl: "https://api.mtn.com",
    subscriptionKey: process.env.MTN_PRODUCTION_SUBSCRIPTION_KEY!,
    callbackUrl: `${process.env.BACKEND_URL}/api/v1/payments/mtn/webhook`,
    primaryKey: process.env.MTN_PRODUCTION_PRIMARY_KEY!,
  };
};

// ===== MTN API CLIENT =====
class MTNMoMoClient {
  private axiosInstance: AxiosInstance;
  private config: MTNConfig;
  private isSandbox: boolean;

  constructor() {
    this.config = getMTNConfig();
    this.isSandbox = process.env.MTN_SANDBOX_MODE === "true" || process.env.NODE_ENV !== "production";

    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
        "Content-Type": "application/json",
        "X-Reference-Id": this.generateRequestId(),
      },
    });

    // Add request/response interceptors for logging
    this.axiosInstance.interceptors.request.use((config) => {
      logger.debug(`MTN API Request: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });

    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug(`MTN API Response: ${response.status}`);
        return response;
      },
      (error) => {
        logger.error("MTN API Error:", error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return crypto.randomUUID();
  }

  /**
   * Initiate payment request
   */
  async initiatePayment(
    msisdn: string,
    amount: number,
    externalId: string,
    payerMessage: string = "AURA Academy Premium Subscription"
  ): Promise<MTNResponse> {
    try {
      if (this.isSandbox) {
        logger.warn("🔔 SANDBOX MODE: Using mock payment response");
        return this.mockPaymentResponse(msisdn, amount, externalId);
      }

      const requestId = this.generateRequestId();

      const response = await this.axiosInstance.post(
        "/v1_0/requesttopay",
        {
          amount: amount.toString(),
          currency: "ZMW",
          externalId,
          payer: {
            partyIdType: "MSISDN",
            partyId: msisdn,
          },
          payerMessage,
          payeeNote: "Premium Subscription",
        },
        {
          headers: {
            "X-Reference-Id": requestId,
          },
        }
      );

      logger.info(`Payment initiated: ${externalId}`);

      return {
        status: "initiated",
        transactionId: response.headers["x-reference-id"],
        referenceId: externalId,
      };
    } catch (error) {
      logger.error("Payment initiation failed:", error);
      throw error;
    }
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(referenceId: string): Promise<MTNResponse> {
    try {
      if (this.isSandbox) {
        logger.warn("🔔 SANDBOX MODE: Returning mock payment status");
        // In sandbox, we mock successful payment after 5 seconds
        return {
          status: "successful",
          message: "Payment completed (sandbox mode)",
        };
      }

      const response = await this.axiosInstance.get(
        `/v1_0/requesttopay/${referenceId}`
      );

      const status = response.data.status;

      logger.info(`Payment status checked: ${referenceId} - ${status}`);

      return {
        status: status.toLowerCase(),
        message: `Payment ${status}`,
      };
    } catch (error) {
      logger.error("Payment status check failed:", error);
      throw error;
    }
  }

  /**
   * Mock payment response for sandbox/development
   */
  private mockPaymentResponse(
    msisdn: string,
    amount: number,
    externalId: string
  ): MTNResponse {
    // Simulate payment response
    logger.warn(
      `📱 MOCK PAYMENT: ${msisdn} - K${amount} (Ref: ${externalId})`
    );

    return {
      status: "initiated",
      transactionId: `MOCK-${crypto.randomBytes(8).toString("hex").toUpperCase()}`,
      referenceId: externalId,
    };
  }
}

// ===== VALIDATION SCHEMAS =====
const PaymentInitiateSchema = z.object({
  mtn_msisdn: z.string().regex(/^\d{10}$/, "Invalid MTN number"),
  amount: z.number().default(10),
});

const PaymentWebhookSchema = z.object({
  externalId: z.string(),
  status: z.enum(["SUCCESSFUL", "FAILED", "PENDING"]),
  amount: z.number().optional(),
  transactionId: z.string().optional(),
});

// ===== PAYMENT ROUTES =====

/**
 * POST /api/v1/payments/mtn/initiate
 * Start MTN MoMo payment process
 */
router.post(
  "/mtn/initiate",
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      const validated = PaymentInitiateSchema.parse(req.body);

      if (!userId) {
        return res.status(400).json({ error: "User ID required" });
      }

      // Get student subscription
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("student_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      // Generate payment reference
      const paymentReference = `AURA-${Date.now()}-${crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase()}`;

      // Create MTN client
      const mtnClient = new MTNMoMoClient();

      // Initiate payment with MTN
      const paymentResponse = await mtnClient.initiatePayment(
        validated.mtn_msisdn,
        validated.amount,
        paymentReference,
        `AURA Academy - Premium Subscription K${validated.amount}/week`
      );

      // Store payment attempt in database
      const { error: dbError } = await supabase
        .from("subscriptions")
        .update({
          mtn_msisdn: validated.mtn_msisdn,
          payment_reference: paymentReference,
          status: "pending",
        })
        .eq("id", subscription.id);

      if (dbError) throw dbError;

      // Log payment event
      await supabase.from("events").insert([
        {
          student_id: userId,
          event_type: "payment_initiated",
          event_data: {
            reference: paymentReference,
            amount: validated.amount,
            msisdn: validated.mtn_msisdn.slice(-4), // Don't store full number
            mode: process.env.MTN_SANDBOX_MODE === "true" ? "sandbox" : "production",
          },
        },
      ]);

      logger.info(`Payment initiated for student: ${userId}`);

      res.json({
        success: true,
        reference: paymentReference,
        status: paymentResponse.status,
        message: `Payment request sent to ${validated.mtn_msisdn}. Please complete the transaction.`,
        isSandboxMode: process.env.MTN_SANDBOX_MODE === "true",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      logger.error("Payment initiation error:", error);
      res.status(500).json({ error: "Payment initiation failed" });
    }
  }
);

/**
 * POST /api/v1/payments/mtn/confirm
 * Confirm/verify MTN payment
 */
router.post(
  "/mtn/confirm",
  async (req: Request, res: Response) => {
    try {
      const { userId, paymentReference } = req.body;

      if (!userId || !paymentReference) {
        return res.status(400).json({ error: "User ID and payment reference required" });
      }

      // Get subscription
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("payment_reference", paymentReference)
        .single();

      if (!subscription) {
        return res.status(404).json({ error: "Payment not found" });
      }

      // Check payment status with MTN
      const mtnClient = new MTNMoMoClient();
      const statusResponse = await mtnClient.checkPaymentStatus(paymentReference);

      if (statusResponse.status === "successful") {
        // Update subscription to paid
        const nextRenewalDate = new Date();
        nextRenewalDate.setDate(nextRenewalDate.getDate() + 7); // 7 days

        const { error: updateError } = await supabase
          .from("subscriptions")
          .update({
            is_paid: true,
            status: "active",
            last_payment_date: new Date().toISOString(),
            next_renewal_date: nextRenewalDate.toISOString(),
            subscription_start_date: new Date().toISOString(),
          })
          .eq("id", subscription.id);

        if (updateError) throw updateError;

        // Log payment event
        await supabase.from("events").insert([
          {
            student_id: userId,
            event_type: "payment_confirmed",
            event_data: {
              reference: paymentReference,
              amount: subscription.amount_paid,
            },
          },
        ]);

        logger.info(`Payment confirmed for student: ${userId}`);

        return res.json({
          success: true,
          message: "Payment confirmed! Premium access activated.",
          nextRenewalDate: nextRenewalDate.toISOString(),
        });
      }

      // Payment still pending
      res.json({
        success: false,
        status: statusResponse.status,
        message: "Payment is still processing. Please try again in a moment.",
      });
    } catch (error) {
      logger.error("Payment confirmation error:", error);
      res.status(500).json({ error: "Payment confirmation failed" });
    }
  }
);

/**
 * GET /api/v1/payments/mtn/status/:referenceId
 * Check payment status
 */
router.get(
  "/mtn/status/:referenceId",
  async (req: Request, res: Response) => {
    try {
      const { referenceId } = req.params;

      const mtnClient = new MTNMoMoClient();
      const statusResponse = await mtnClient.checkPaymentStatus(referenceId);

      res.json({
        reference: referenceId,
        status: statusResponse.status,
        message: statusResponse.message,
      });
    } catch (error) {
      logger.error("Status check error:", error);
      res.status(500).json({ error: "Failed to check payment status" });
    }
  }
);

/**
 * POST /api/v1/payments/mtn/webhook
 * MTN callback webhook (payment confirmation)
 */
router.post(
  "/mtn/webhook",
  async (req: Request, res: Response) => {
    try {
      const validated = PaymentWebhookSchema.parse(req.body);

      logger.info(`MTN Webhook received: ${validated.externalId} - ${validated.status}`);

      // Get subscription
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("payment_reference", validated.externalId)
        .single();

      if (!subscription) {
        logger.warn(`Webhook: Payment not found - ${validated.externalId}`);
        return res.json({ received: true }); // ACK to MTN
      }

      if (validated.status === "SUCCESSFUL") {
        const nextRenewalDate = new Date();
        nextRenewalDate.setDate(nextRenewalDate.getDate() + 7);

        await supabase
          .from("subscriptions")
          .update({
            is_paid: true,
            status: "active",
            last_payment_date: new Date().toISOString(),
            next_renewal_date: nextRenewalDate.toISOString(),
          })
          .eq("id", subscription.id);

        // Log event
        await supabase.from("events").insert([
          {
            student_id: subscription.student_id,
            event_type: "payment_webhook_confirmed",
            event_data: { reference: validated.externalId },
          },
        ]);

        logger.info(`Webhook payment confirmed: ${subscription.student_id}`);
      } else if (validated.status === "FAILED") {
        await supabase
          .from("subscriptions")
          .update({ status: "failed" })
          .eq("id", subscription.id);

        logger.warn(`Webhook payment failed: ${subscription.student_id}`);
      }

      // ACK to MTN
      res.json({ received: true });
    } catch (error) {
      logger.error("Webhook processing error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  }
);

export default router;
