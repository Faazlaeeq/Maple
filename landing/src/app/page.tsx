'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Calendar, MessageSquare, Phone, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const springConfig = { type: 'spring' as const, stiffness: 260, damping: 20 };

  return (
    <div className="min-h-screen border-t-8 border-primary">
      
      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between border-b border-muted/20">
        <div className="font-display font-bold text-2xl tracking-tightest">Maple.</div>
        <div className="flex items-center gap-8 text-sm font-medium">
          <Link href="#features" className="hover:text-primary transition-colors">Features</Link>
          <Link href="#pricing" className="hover:text-primary transition-colors">Pricing</Link>
          <Link href="#pricing" className="bg-primary text-bg px-6 py-2.5 rounded-full font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
            Get Started
          </Link>
        </div>
      </nav>

      <main>
        {/* HERO SECTION */}
        <section className="max-w-7xl mx-auto px-6 pt-24 pb-32 grid lg:grid-cols-2 gap-16 items-center">
          <div className="max-w-2xl">
            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ ...springConfig, delay: 0.1 }}
              className="font-display text-[clamp(3rem,5vw,5rem)] font-extrabold leading-[1.05] tracking-tightest text-balance"
            >
              Never miss a new patient again.
            </motion.h1>
            
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ ...springConfig, delay: 0.2 }}
              className="mt-8 text-xl text-muted max-w-xl leading-relaxed"
            >
              The AI receptionist that captures leads, answers questions, and books appointments directly onto your Google Calendar while you sleep.
            </motion.p>
            
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ ...springConfig, delay: 0.3 }}
              className="mt-12 flex flex-wrap items-center gap-6"
            >
              <Link href="#pricing" className="bg-primary text-bg px-8 py-4 text-lg font-bold flex items-center gap-2 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all">
                View Pricing <ArrowRight className="w-5 h-5" />
              </Link>
              <span className="text-sm font-medium text-muted">Set up in 5 minutes. No coding required.</span>
            </motion.div>
          </div>

          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...springConfig, delay: 0.4 }}
            className="relative aspect-[4/5] overflow-hidden rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-muted/10"
          >
            <img 
              src="/hero_bg.png?v=2" 
              alt="3D Glassmorphism representation of an AI chat bubble and calendar sync" 
              className="w-full h-full object-cover"
            />
          </motion.div>
        </section>

        {/* METRICS SECTION - Asymmetrical Grid */}
        <section className="bg-surface py-20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-6">
              
              <div className="p-10 md:p-12 flex flex-col justify-between h-[280px] bg-bg rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-muted/10 hover:shadow-md hover:-translate-y-1 transition-all">
                <ShieldCheck className="w-8 h-8 text-primary" />
                <div>
                  <div className="font-display text-5xl font-bold tracking-tightest">40+</div>
                  <div className="mt-2 text-sm font-medium text-muted uppercase tracking-widest">Hours Recovered / Mo</div>
                </div>
              </div>

              <div className="p-10 md:p-12 flex flex-col justify-between h-[280px] bg-primary text-bg rounded-3xl shadow-xl hover:-translate-y-1 transition-all">
                <MessageSquare className="w-8 h-8 text-accent" />
                <div>
                  <div className="font-display text-5xl font-bold tracking-tightest text-accent">25%</div>
                  <div className="mt-2 text-sm font-medium opacity-90 uppercase tracking-widest">More After-Hours Leads</div>
                </div>
              </div>

              <div className="p-10 md:p-12 flex flex-col justify-between h-[280px] bg-bg rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-muted/10 hover:shadow-md hover:-translate-y-1 transition-all">
                <Calendar className="w-8 h-8 text-primary" />
                <div>
                  <div className="font-display text-5xl font-bold tracking-tightest">100%</div>
                  <div className="mt-2 text-sm font-medium text-muted uppercase tracking-widest">Calendar Sync</div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* FEATURES - Editorial Layout */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-40">
          <div className="grid md:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tightest leading-tight">
                Direct integration with your existing workflow.
              </h2>
              <div className="mt-8 space-y-6">
                <div className="border-l-2 border-primary pl-6 py-2">
                  <h3 className="text-lg font-bold">Google Calendar Sync</h3>
                  <p className="mt-2 text-muted leading-relaxed">Maple checks your real-time availability and books appointments directly into your schedule. No double-bookings, ever.</p>
                </div>
                <div className="border-l-2 border-muted/20 pl-6 py-2">
                  <h3 className="text-lg font-bold">Verified Leads</h3>
                  <p className="mt-2 text-muted leading-relaxed">We use Twilio OTP to verify patient phone numbers before booking, ensuring you only get real, actionable appointments.</p>
                </div>
                <div className="border-l-2 border-muted/20 pl-6 py-2">
                  <h3 className="text-lg font-bold">Instant Notifications</h3>
                  <p className="mt-2 text-muted leading-relaxed">Every time a lead is captured or an appointment is booked, your practice manager receives an instant email breakdown.</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col justify-center h-full">
              <div className="relative aspect-square overflow-hidden rounded-3xl shadow-2xl border border-muted/10">
                <img 
                  src="/features_bg.png?v=2" 
                  alt="A pristine, highly modern and calming dental clinic reception desk bathed in warm morning light" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="border-t border-muted/20 bg-surface">
          <div className="max-w-7xl mx-auto px-6 py-40">
            <div className="text-center max-w-2xl mx-auto mb-20">
              <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tightest">Simple, transparent pricing.</h2>
              <p className="mt-6 text-lg text-muted">No hidden setup fees. Start automating your front desk today.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Monthly */}
              <div className="p-10 rounded-3xl border border-muted/10 bg-bg shadow-[0_4px_24px_rgba(0,0,0,0.04)] flex flex-col hover:shadow-lg transition-all hover:-translate-y-1">
                <h3 className="text-xl font-bold">Monthly</h3>
                <div className="mt-4 font-display text-6xl font-bold tracking-tightest">$20<span className="text-2xl text-muted">/mo</span></div>
                <p className="mt-4 text-muted border-b border-muted/10 pb-8">Perfect for small clinics testing the waters.</p>
                <ul className="mt-8 space-y-4 mb-12 flex-grow text-sm font-medium">
                  <li className="flex items-center gap-3"><ShieldCheck className="w-5 h-5 text-primary" /> Unlimited AI chats</li>
                  <li className="flex items-center gap-3"><ShieldCheck className="w-5 h-5 text-primary" /> Google Calendar Sync</li>
                  <li className="flex items-center gap-3"><ShieldCheck className="w-5 h-5 text-primary" /> Twilio OTP Verification</li>
                </ul>
                <button className="w-full border-2 border-primary text-primary py-4 rounded-full font-bold hover:bg-primary hover:text-bg transition-colors">
                  Subscribe Monthly
                </button>
              </div>

              {/* Lifetime */}
              <div className="p-10 rounded-3xl bg-primary text-bg shadow-[0_8px_30px_rgba(35,70,50,0.4)] flex flex-col relative overflow-hidden hover:shadow-2xl transition-all hover:-translate-y-1">
                <div className="absolute top-6 right-6 bg-accent text-ink text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">Best Value</div>
                <h3 className="text-xl font-bold text-bg/90">Lifetime</h3>
                <div className="mt-4 font-display text-6xl font-bold tracking-tightest text-accent">$300</div>
                <p className="mt-4 text-bg/70 border-b border-bg/20 pb-8">Pay once, own the software forever.</p>
                <ul className="mt-8 space-y-4 mb-12 flex-grow text-sm font-medium">
                  <li className="flex items-center gap-3"><ShieldCheck className="w-5 h-5 text-accent" /> Unlimited AI chats forever</li>
                  <li className="flex items-center gap-3"><ShieldCheck className="w-5 h-5 text-accent" /> Google Calendar Sync</li>
                  <li className="flex items-center gap-3"><ShieldCheck className="w-5 h-5 text-accent" /> Twilio OTP Verification</li>
                  <li className="flex items-center gap-3"><ShieldCheck className="w-5 h-5 text-accent" /> Priority Support</li>
                </ul>
                <button className="w-full bg-accent text-ink py-4 rounded-full font-bold hover:bg-bg hover:text-primary transition-colors shadow-md">
                  Buy Lifetime
                </button>
              </div>
            </div>
          </div>
        </section>

      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 flex items-center justify-between border-t border-muted/20 text-sm font-medium text-muted">
        <div>© {new Date().getFullYear()} Maple AI. All rights reserved.</div>
        <div className="flex gap-6">
          <Link href="#" className="hover:text-primary">Terms</Link>
          <Link href="#" className="hover:text-primary">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
