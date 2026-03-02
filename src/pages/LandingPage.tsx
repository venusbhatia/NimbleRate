import {
  BarChart3,
  CloudSun,
  ArrowRight,
  Zap,
  TrendingUp,
  Ticket
} from "lucide-react";
import { Link } from "../router";
import { LandingNav } from "../components/layout/LandingNav";
import logoSvg from "../assets/nimblerate_logo.svg";

const features = [
  {
    icon: BarChart3,
    title: "Market Intelligence",
    description:
      "See what competitors charge in your area. Real-time hotel rate data, so you never price blind.",
    color: "text-brand-emerald"
  },
  {
    icon: Zap,
    title: "Dynamic Pricing",
    description:
      "Our algorithm blends occupancy, seasonality, and demand into one recommended rate — updated daily.",
    color: "text-gold-500"
  },
  {
    icon: Ticket,
    title: "Event Awareness",
    description:
      "Concerts, conferences, festivals — we detect nearby events that drive demand and adjust your price.",
    color: "text-violet-500"
  },
  {
    icon: CloudSun,
    title: "Weather Impact",
    description:
      "Sunny weekends fill beach hotels. Rainy days hurt city B&Bs. Weather is factored in automatically.",
    color: "text-sky-500"
  }
];

const steps = [
  {
    number: "01",
    title: "Tell us about your property",
    description: "Location, property type, and your current occupancy — takes 30 seconds."
  },
  {
    number: "02",
    title: "We crunch the data",
    description:
      "Hotel rates, events, weather, holidays, and seasonality are combined into a single price recommendation."
  },
  {
    number: "03",
    title: "Set your best price",
    description:
      "See a 30-day rate calendar with daily recommendations. Copy, export, or just use it as a guide."
  }
];

const stats = [
  { value: "23%", label: "Average revenue uplift" },
  { value: "7", label: "Pricing factors analysed" },
  { value: "30", label: "Days of recommendations" },
  { value: "<1 min", label: "Time to first insight" }
];

export function LandingPage() {
  return (
    <div className="min-h-screen text-dune-950 dark:text-gray-50">
      <LandingNav />

      {/* ===== HERO ===== */}
      <section className="relative flex min-h-[90vh] items-center overflow-hidden pt-24">
        {/* Background decorations */}
        <div className="pointer-events-none absolute -right-40 -top-40 h-[600px] w-[600px] rounded-full bg-gold-200/30 blur-3xl dark:bg-gold-900/20" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full bg-emerald-200/20 blur-3xl dark:bg-emerald-900/10" />

        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="animate-hero-fade">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold-200 bg-gold-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gold-800 dark:border-gold-700/40 dark:bg-gold-900/20 dark:text-gold-300">
                <Zap className="h-3.5 w-3.5" />
                Built for independent hotels
              </p>
              <h1 className="font-heading text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                Smart pricing for{" "}
                <span className="bg-gradient-to-r from-gold-500 to-gold-600 bg-clip-text text-transparent">
                  boutique stays
                </span>
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-dune-600 dark:text-gray-400">
                NimbleRate gives independent hotels, hostels, and B&Bs the same pricing
                intelligence that big chains use — without the cost or complexity.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="dashboard"
                  className="group inline-flex items-center gap-2 rounded-xl bg-gold-500 px-6 py-3 text-base font-semibold text-dune-950 shadow-glow transition hover:bg-gold-400 active:scale-[0.98]"
                >
                  See your pricing
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <a
                  href="#how-it-works"
                  className="text-sm font-semibold text-dune-600 transition hover:text-dune-900 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  How does it work? ↓
                </a>
              </div>
            </div>

            {/* Hero visual — floating rate cards */}
            <div className="relative hidden lg:block">
              <div className="animate-float mx-auto w-80">
                <div className="rounded-2xl border border-gray-200/60 bg-white/80 p-6 shadow-card backdrop-blur dark:border-gray-700/40 dark:bg-neutral-900/80">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tonight's Rate</p>
                  <p className="mt-2 text-5xl font-extrabold tabular-nums tracking-tight text-brand-charcoal dark:text-white">
                    $189
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <TrendingUp className="h-3.5 w-3.5" />
                    +12% vs last week
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {["Mon", "Tue", "Wed"].map((day, i) => (
                      <div
                        key={day}
                        className={`rounded-lg p-2 text-center text-xs font-semibold ${
                          i === 1
                            ? "bg-gold-100 text-gold-900 dark:bg-gold-900/30 dark:text-gold-300"
                            : "bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-gray-300"
                        }`}
                      >
                        <p>{day}</p>
                        <p className="mt-0.5 tabular-nums">${[172, 189, 175][i]}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Small secondary card */}
              <div className="absolute -bottom-4 -left-8 animate-float stagger-3">
                <div className="rounded-xl border border-gray-200/60 bg-white/80 px-4 py-3 shadow-card backdrop-blur dark:border-gray-700/40 dark:bg-neutral-900/80">
                  <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-violet-500" />
                    <span className="text-xs font-semibold">Jazz Festival nearby</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">+18% demand boost</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PROBLEM / SOLUTION ===== */}
      <section className="py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Why NimbleRate?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-dune-600 dark:text-gray-400">
            Revenue Management Systems cost thousands per year and need specialist training.
            Your 20-room guesthouse doesn't need that overhead — it needs answers.
          </p>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="pb-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 sm:grid-cols-2">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`animate-reveal stagger-${i + 1} rounded-2xl border border-gray-200/60 bg-white/60 p-8 shadow-card backdrop-blur transition hover:shadow-card-hover dark:border-gray-700/40 dark:bg-neutral-900/60`}
                >
                  <div className={`mb-4 inline-flex rounded-xl bg-gray-100 p-3 dark:bg-neutral-800 ${feature.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-dune-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how-it-works" className="border-y border-gray-200/60 bg-dune-50/50 py-24 dark:border-gray-700/40 dark:bg-neutral-900/30">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <div className="mt-16 grid gap-12 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.number} className={`animate-reveal stagger-${i + 1} text-center`}>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-100 text-xl font-extrabold text-gold-800 dark:bg-gold-900/30 dark:text-gold-300">
                  {step.number}
                </div>
                <h3 className="mt-5 text-lg font-bold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-dune-600 dark:text-gray-400">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== STATS ===== */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, i) => (
              <div key={stat.label} className={`animate-reveal stagger-${i + 1} text-center`}>
                <p className="font-heading text-4xl font-extrabold tracking-tight text-gold-500">
                  {stat.value}
                </p>
                <p className="mt-2 text-sm font-medium text-dune-600 dark:text-gray-400">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA FOOTER ===== */}
      <section className="border-t border-gray-200/60 bg-brand-charcoal py-20 dark:border-gray-700/40">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <img src={logoSvg} alt="" className="mx-auto mb-6 h-12" style={{ filter: "brightness(1.6) saturate(1.3)" }} />
          <h2 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to price smarter?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-gray-400">
            No credit card. No spreadsheet imports. Just tell us your location and see your first
            pricing recommendation in under a minute.
          </p>
          <Link
            to="dashboard"
            className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-gold-500 px-8 py-3.5 text-base font-semibold text-dune-950 shadow-glow transition hover:bg-gold-400 active:scale-[0.98]"
          >
            Get started — it's free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-gray-800 bg-brand-charcoal py-8">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} NimbleRate. All rights reserved.
            </p>
            <div className="flex gap-6">
              <a href="#" className="text-xs text-gray-500 transition hover:text-gray-300">Privacy</a>
              <a href="#" className="text-xs text-gray-500 transition hover:text-gray-300">Terms</a>
              <a href="#" className="text-xs text-gray-500 transition hover:text-gray-300">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
