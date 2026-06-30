import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Zap } from "lucide-react";
import { useEffect, useRef, Suspense, lazy } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";

// Lazy load Three.js component for performance
const StarfieldCanvas = lazy(() => import("@/components/Starfield"));

export default function Landing() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Track page view in PostHog
    if (window.__PostHog) {
      window.__PostHog.capture("landing_page_view");
    }
  }, []);

  const features = [
    {
      icon: "📚",
      title: "Upload & Simplify",
      description: "AI breaks down complex PDFs into digestible content",
    },
    {
      icon: "🧠",
      title: "AI Quiz Generation",
      description: "Auto-generate quizzes from topics, PDFs, or lectures",
    },
    {
      icon: "📊",
      title: "Track Progress",
      description: "Visual progress bars and completion percentages",
    },
    {
      icon: "🏆",
      title: "Earn Points & Badges",
      description: "Gamified learning with leaderboards and streaks",
    },
    {
      icon: "💬",
      title: "Study Groups",
      description: "Connect with peers studying the same courses",
    },
    {
      icon: "⚡",
      title: "Instant Explanations",
      description: "AI explains any concept in seconds",
    },
  ];

  const stats = [
    { value: "500+", label: "Active Students" },
    { value: "40%", label: "Day-7 Retention" },
    { value: "2.5K", label: "Quizzes Generated" },
  ];

  const testimonials = [
    {
      name: "Chibvuu",
      university: "UNZA",
      text: "AURA saved me during exam prep. The AI summaries are insanely good.",
      avatar: "👨‍🎓",
    },
    {
      name: "Zara",
      university: "CBU",
      text: "Finally, a study tool built for us. No more expensive foreign apps.",
      avatar: "👩‍🎓",
    },
    {
      name: "Mwale",
      university: "Mulungushi",
      text: "The quiz generation is wild. It actually helps me understand the material.",
      avatar: "👨‍💼",
    },
  ];

  return (
    <div ref={containerRef} className="relative min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* 3D Starfield Background - Lazy loaded */}
      <Suspense fallback={<div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 to-transparent" />}>
        <div className="absolute inset-0 z-0">
          <StarfieldCanvas />
        </div>
      </Suspense>

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-4 md:px-12 backdrop-blur-sm bg-black/10 border-b border-indigo-500/10">
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-indigo-600 bg-clip-text text-transparent">
            ✨ AURA
          </div>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm hover:text-indigo-400 transition">
            Features
          </a>
          <a href="#pricing" className="text-sm hover:text-indigo-400 transition">
            Pricing
          </a>
          <a href="#testimonials" className="text-sm hover:text-indigo-400 transition">
            Testimonials
          </a>
        </div>
        <Button
          onClick={() => navigate("/auth")}
          className="bg-indigo-600 hover:bg-indigo-700"
          size="sm"
        >
          Sign In
        </Button>
      </nav>

      {/* Hero Section */}
      <section className="relative z-20 px-6 md:px-12 py-20 md:py-32 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/30 mb-8"
          >
            <Zap className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-medium text-indigo-300">
              Zambian students, trusted by thousands
            </span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 text-balance leading-tight"
          >
            Study Smarter with{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-600 bg-clip-text text-transparent">
              AI-Powered Learning
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-lg md:text-xl text-slate-300 mb-12 max-w-2xl mx-auto text-balance"
          >
            Upload PDFs. Get summaries. Generate quizzes. Track progress. All powered by AI. K10/week.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col md:flex-row gap-4 justify-center mb-16"
          >
            <Button
              onClick={() => navigate("/auth?mode=signup")}
              size="lg"
              className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold px-8 group"
            >
              Start Free Trial (7 Days)
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              className="border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
            >
              See Features
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-3 gap-8 max-w-md mx-auto"
          >
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-indigo-400">
                  {stat.value}
                </div>
                <div className="text-xs md:text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="relative z-20 px-6 md:px-12 py-20 md:py-32 bg-gradient-to-b from-transparent via-indigo-950/5 to-transparent"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Powerful features for serious students
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Everything you need to ace your exams, built specifically for Zambian university students.
            </p>
          </motion.div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="group p-6 rounded-lg border border-indigo-500/20 hover:border-indigo-500/50 bg-indigo-950/10 hover:bg-indigo-950/20 transition"
              >
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section
        id="pricing"
        className="relative z-20 px-6 md:px-12 py-20 md:py-32 bg-gradient-to-b from-transparent to-indigo-950/5"
      >
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="mb-12"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-slate-400">
              No hidden fees. No surprise charges. Just K10 per week.
            </p>
          </motion.div>

          {/* Pricing Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            className="p-8 rounded-lg border border-indigo-500/30 bg-gradient-to-br from-indigo-950/20 to-slate-950/50 backdrop-blur"
          >
            <div className="text-5xl font-bold text-indigo-400 mb-2">
              K10<span className="text-xl text-slate-400">/week</span>
            </div>
            <p className="text-slate-400 mb-8">After 7-day free trial</p>

            {/* Features included */}
            <div className="space-y-3 mb-8 text-left">
              {[
                "Unlimited PDF uploads",
                "AI quiz generation",
                "Offline access",
                "Study groups",
                "Priority support",
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                  <span className="text-slate-300">{feature}</span>
                </div>
              ))}
            </div>

            <Button
              onClick={() => navigate("/auth?mode=signup")}
              size="lg"
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              Start Your Free Trial
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section
        id="testimonials"
        className="relative z-20 px-6 md:px-12 py-20 md:py-32"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Loved by students across Zambia
            </h2>
          </motion.div>

          {/* Testimonials Grid */}
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-lg border border-indigo-500/20 bg-indigo-950/10"
              >
                <div className="text-3xl mb-4">{testimonial.avatar}</div>
                <p className="text-slate-300 mb-4 italic">"{testimonial.text}"</p>
                <div>
                  <div className="font-semibold">{testimonial.name}</div>
                  <div className="text-sm text-indigo-400">{testimonial.university}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="relative z-20 px-6 md:px-12 py-16 border-t border-indigo-500/10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to transform your study habits?
            </h2>
            <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
              Join 500+ students already using AURA to ace their exams. Get 7 days free.
            </p>
            <Button
              onClick={() => navigate("/auth?mode=signup")}
              size="lg"
              className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800"
            >
              Start Your Free Trial
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-20 border-t border-slate-800 px-6 md:px-12 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center text-sm text-slate-400">
          <div>© 2024 AURA Academy. Built for Zambian students.</div>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-indigo-400 transition">
              Privacy
            </a>
            <a href="#" className="hover:text-indigo-400 transition">
              Terms
            </a>
            <a href="#" className="hover:text-indigo-400 transition">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
