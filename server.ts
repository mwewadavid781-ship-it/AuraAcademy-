/**
 * AURA ACADEMY - PRODUCTION BACKEND
 * Express.js + TypeScript + Supabase + MTN MoMo
 * 
 * Architecture: Clean, Scalable, Enterprise-Ready
 */

import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import pino from "pino";
import pinoHttp from "pino-http";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { z } from "zod";
import Queue from "bull";
import axios from "axios";
import crypto from "crypto";

// ===== ENVIRONMENT SETUP =====
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_KEY",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "NODE_ENV",
  "PORT",
];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(`❌ Missing environment variable: ${envVar}`);
    process.exit(1);
  }
});

// ===== LOGGER SETUP =====
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      singleLine: false,
    },
  },
});

const httpLogger = pinoHttp({ logger });

// ===== TYPE DEFINITIONS =====
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    iat: number;
    exp: number;
  };
}

interface TokenPayload {
  sub: string;
  email: string;
  type: "access" | "refresh";
}

// ===== SUPABASE CLIENT =====
const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

// ===== REDIS/BULL QUEUE (for async jobs) =====
const pdfProcessingQueue = new Queue("pdf-processing", {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
});

const quizGenerationQueue = new Queue("quiz-generation", {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
});

// ===== EXPRESS APP SETUP =====
const app: Express = express();

// Middleware
app.use(helmet()); // Security headers
app.use(compression()); // Gzip compression
app.use(httpLogger); // HTTP logging
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ===== REQUEST/RESPONSE LOGGING =====
app.use((req: AuthRequest, res: Response, next: NextFunction) => {
  res.on("finish", () => {
    logger.info({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      userId: req.user?.id || "anonymous",
    });
  });
  next();
});

// ===== AUTHENTICATION MIDDLEWARE =====
const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // "Bearer token"

  if (!token) {
    logger.warn("No token provided");
    return res.status(401).json({ error: "No authentication token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
    
    if (decoded.type !== "access") {
      return res.status(401).json({ error: "Invalid token type" });
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      iat: decoded.iat,
      exp: decoded.exp,
    };
    next();
  } catch (error) {
    logger.error("Token verification failed:", error);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

// ===== VALIDATION SCHEMAS =====
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  year_of_study: z.number().min(1).max(4),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const CreateCourseSchema = z.object({
  course_name: z.string().min(1),
  course_code: z.string(),
  semester: z.string(),
  exam_date: z.string().optional(),
  topics: z.array(z.string()),
});

const CreateTopicSchema = z.object({
  topic_name: z.string().min(1),
  topic_description: z.string().optional(),
  difficulty_level: z.enum(["beginner", "intermediate", "advanced"]),
  estimated_study_time: z.number().optional(),
});

const PaymentInitiateSchema = z.object({
  mtn_msisdn: z.string().regex(/^\d{10}$/),
  amount: z.number().default(10), // K10 default
});

// ===== HELPER FUNCTIONS =====

/**
 * Generate JWT tokens
 */
function generateTokens(userId: string, email: string) {
  const accessToken = jwt.sign(
    {
      sub: userId,
      email,
      type: "access",
    },
    process.env.JWT_SECRET!,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    {
      sub: userId,
      email,
      type: "refresh",
    },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
}

/**
 * Hash password
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verify password
 */
async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate trial end date (7 days from now)
 */
function generateTrialEndDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
}

// ===== ROUTES =====

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ===== AUTH ENDPOINTS =====

/**
 * POST /api/v1/auth/register
 * Create new student account
 */
app.post("/api/v1/auth/register", async (req: Request, res: Response) => {
  try {
    // Validate request
    const validated = RegisterSchema.parse(req.body);

    // Check if email exists
    const { data: existing } = await supabase
      .from("students")
      .select("id")
      .eq("email", validated.email)
      .single();

    if (existing) {
      logger.warn(`Registration attempt with existing email: ${validated.email}`);
      return res.status(409).json({ error: "Email already registered" });
    }

    // Hash password
    const password_hash = await hashPassword(validated.password);

    // Create student
    const { data: student, error } = await supabase
      .from("students")
      .insert([
        {
          email: validated.email,
          name: validated.name,
          year_of_study: validated.year_of_study,
          password_hash,
          last_login: new Date().toISOString(),
          study_streak: 1,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Create subscription record (free trial)
    const trialEndDate = generateTrialEndDate();
    await supabase.from("subscriptions").insert([
      {
        student_id: student.id,
        plan_type: "free_trial",
        trial_start_date: new Date().toISOString(),
        trial_end_date: trialEndDate.toISOString(),
        status: "active",
      },
    ]);

    // Create progress record
    await supabase.from("user_progress").insert([
      {
        student_id: student.id,
        total_topics_completed: 0,
        aura_points: 0,
        level: 1,
      },
    ]);

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(student.id, student.email);

    // Track event
    await supabase.from("events").insert([
      {
        student_id: student.id,
        event_type: "signup",
        event_data: { method: "email" },
      },
    ]);

    logger.info(`New student registered: ${student.email}`);

    res.status(201).json({
      student: {
        id: student.id,
        email: student.email,
        name: student.name,
      },
      accessToken,
      refreshToken,
      trial_ends_at: trialEndDate.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

/**
 * POST /api/v1/auth/login
 * Authenticate student
 */
app.post("/api/v1/auth/login", async (req: Request, res: Response) => {
  try {
    const validated = LoginSchema.parse(req.body);

    // Find student
    const { data: student, error } = await supabase
      .from("students")
      .select("*")
      .eq("email", validated.email)
      .single();

    if (error || !student) {
      logger.warn(`Login attempt with non-existent email: ${validated.email}`);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const passwordValid = await verifyPassword(
      validated.password,
      student.password_hash
    );

    if (!passwordValid) {
      logger.warn(`Failed login attempt for: ${validated.email}`);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Get subscription status
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Update last login
    await supabase
      .from("students")
      .update({ last_login: new Date().toISOString() })
      .eq("id", student.id);

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(student.id, student.email);

    // Track event
    await supabase.from("events").insert([
      {
        student_id: student.id,
        event_type: "login",
      },
    ]);

    logger.info(`Student logged in: ${student.email}`);

    res.json({
      student: {
        id: student.id,
        email: student.email,
        name: student.name,
        year_of_study: student.year_of_study,
      },
      subscription: {
        status: subscription?.status,
        plan_type: subscription?.plan_type,
        trial_ends_at: subscription?.trial_end_date,
        is_paid: subscription?.is_paid,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token
 */
app.post("/api/v1/auth/refresh", (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: "No refresh token provided" });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET!
    ) as TokenPayload;

    if (decoded.type !== "refresh") {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const { accessToken } = generateTokens(decoded.sub, decoded.email);

    res.json({ accessToken });
  } catch (error) {
    logger.error("Refresh token error:", error);
    res.status(403).json({ error: "Invalid refresh token" });
  }
});

// ===== STUDENT ENDPOINTS =====

/**
 * GET /api/v1/students/me
 * Get current student profile
 */
app.get(
  "/api/v1/students/me",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { data: student, error } = await supabase
        .from("students")
        .select("id, email, name, year_of_study, profile_picture_url, study_streak")
        .eq("id", req.user!.id)
        .single();

      if (error) throw error;

      const { data: progress } = await supabase
        .from("user_progress")
        .select("*")
        .eq("student_id", req.user!.id)
        .single();

      res.json({
        student,
        progress,
      });
    } catch (error) {
      logger.error("Get profile error:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  }
);

// ===== COURSE ENDPOINTS =====

/**
 * POST /api/v1/courses
 * Create new course
 */
app.post(
  "/api/v1/courses",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const validated = CreateCourseSchema.parse(req.body);

      const { data: course, error } = await supabase
        .from("courses")
        .insert([
          {
            student_id: req.user!.id,
            course_name: validated.course_name,
            course_code: validated.course_code,
            semester: validated.semester,
            exam_date: validated.exam_date,
            total_topics: validated.topics.length,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Create topics
      const topicData = validated.topics.map((topic) => ({
        course_id: course.id,
        topic_name: topic,
        is_completed: false,
      }));

      await supabase.from("topics").insert(topicData);

      // Track event
      await supabase.from("events").insert([
        {
          student_id: req.user!.id,
          event_type: "course_created",
          event_data: { course_id: course.id, topic_count: validated.topics.length },
        },
      ]);

      logger.info(`Course created: ${course.id} for student ${req.user!.id}`);

      res.status(201).json({ course });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      logger.error("Create course error:", error);
      res.status(500).json({ error: "Failed to create course" });
    }
  }
);

/**
 * GET /api/v1/courses
 * Get all courses for student
 */
app.get(
  "/api/v1/courses",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { data: courses, error } = await supabase
        .from("courses")
        .select(
          `
          *,
          topics (
            id,
            topic_name,
            is_completed,
            difficulty_level,
            estimated_study_time
          )
        `
        )
        .eq("student_id", req.user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      res.json({ courses });
    } catch (error) {
      logger.error("Get courses error:", error);
      res.status(500).json({ error: "Failed to fetch courses" });
    }
  }
);

// ===== TOPIC ENDPOINTS =====

/**
 * PUT /api/v1/topics/:topicId/complete
 * Mark topic as completed
 */
app.put(
  "/api/v1/topics/:topicId/complete",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { topicId } = req.params;

      // Get topic with course info
      const { data: topic, error: topicError } = await supabase
        .from("topics")
        .select("*, courses(id, student_id)")
        .eq("id", topicId)
        .single();

      if (topicError || !topic) {
        return res.status(404).json({ error: "Topic not found" });
      }

      // Verify ownership
      if (topic.courses.student_id !== req.user!.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Mark complete
      const { error: updateError } = await supabase
        .from("topics")
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq("id", topicId);

      if (updateError) throw updateError;

      // Update student progress
      const { data: progress } = await supabase
        .from("user_progress")
        .select("total_topics_completed, aura_points")
        .eq("student_id", req.user!.id)
        .single();

      await supabase
        .from("user_progress")
        .update({
          total_topics_completed: (progress?.total_topics_completed || 0) + 1,
          aura_points: (progress?.aura_points || 0) + 10,
        })
        .eq("student_id", req.user!.id);

      // Track event
      await supabase.from("events").insert([
        {
          student_id: req.user!.id,
          event_type: "topic_completed",
          event_data: { topic_id: topicId },
        },
      ]);

      logger.info(`Topic completed: ${topicId} for student ${req.user!.id}`);

      res.json({
        message: "Topic marked as complete",
        aura_points_earned: 10,
      });
    } catch (error) {
      logger.error("Complete topic error:", error);
      res.status(500).json({ error: "Failed to complete topic" });
    }
  }
);

export default app;
export { logger, supabase, pdfProcessingQueue, quizGenerationQueue };
