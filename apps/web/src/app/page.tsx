'use client';

import { Download, Eye, Github, MessageCircle, Star, Users, Zap } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

function GitHubStars() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    fetch('https://api.github.com/repos/AgentOrchestrator/AgentBase')
      .then((res) => res.json())
      .then((data) => {
        if (data.stargazers_count !== undefined) {
          setStars(data.stargazers_count);
        }
      })
      .catch(() => {
        // Silently fail - stars will just not show
      });
  }, []);

  return (
    <a
      href="https://github.com/AgentOrchestrator/AgentBase"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium text-gray-700"
    >
      <Github className="w-4 h-4" />
      <span>GitHub</span>
      {stars !== null && (
        <>
          <span className="w-px h-4 bg-gray-300" />
          <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
          <span>{stars}</span>
        </>
      )}
    </a>
  );
}

function DiscordLink() {
  return (
    <a
      href="https://discord.gg/mb8q2rf8"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#5865F2] hover:bg-[#4752C4] transition-colors text-sm font-medium text-white"
    >
      <MessageCircle className="w-4 h-4" />
      <span>Discord</span>
    </a>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-white shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-gray-700" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-gray-50/50 to-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-white.png"
              alt="Agent Base"
              width={120}
              height={32}
              className="h-6 w-auto invert"
            />
          </div>
          <div className="flex items-center gap-3">
            <GitHubStars />
            <DiscordLink />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="pt-32 pb-20">
        <div className="max-w-6xl mx-auto px-6">
          {/* Hero Content */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
              Your AI Coding Companions,{' '}
              <span className="bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 bg-clip-text text-transparent">
                Connected
              </span>
            </h1>

            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Agent Base aggregates chat histories from your AI coding assistants—Claude Code,
              Cursor, VSCode, Windsurf, and more—into a unified visual workspace. See the bigger
              picture of your development journey with AI-powered summaries for team collaboration.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="gap-2 px-8">
                <Download className="w-5 h-5" />
                Download for macOS
              </Button>
              <Button size="lg" variant="outline" className="gap-2 px-8">
                <Download className="w-5 h-5" />
                Download for Windows
              </Button>
            </div>

            <p className="mt-4 text-sm text-gray-500">Free and open source. Linux coming soon.</p>
          </div>

          {/* Demo GIF */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-200 mb-24">
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none z-10" />
            <Image
              src="/demo.gif"
              alt="Agent Base Demo"
              width={1200}
              height={675}
              className="w-full h-auto"
              unoptimized
            />
          </div>

          {/* Features */}
          <div className="mb-24">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
              Everything in one place
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <FeatureCard
                icon={Zap}
                title="Multi-Assistant Support"
                description="Connect Claude Code, Cursor, VSCode Copilot, Factory, Codex, and more. All your AI conversations in one unified view."
              />
              <FeatureCard
                icon={Eye}
                title="Visual Workspace"
                description="See your coding sessions as connected nodes. Understand relationships between conversations and track your development flow."
              />
              <FeatureCard
                icon={Users}
                title="Team Collaboration"
                description="Share insights with your team. AI-powered summaries help everyone stay on the same page about what's being built."
              />
            </div>
          </div>

          {/* Screenshots Gallery */}
          <div className="mb-24">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">See it in action</h2>
            <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
              A clean, intuitive interface that makes it easy to navigate your AI-assisted
              development history.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl overflow-hidden shadow-lg border border-gray-200 hover:shadow-xl transition-shadow"
                >
                  <Image
                    src={`/screenshot_${i}.jpeg`}
                    alt={`Agent Base Screenshot ${i + 1}`}
                    width={600}
                    height={400}
                    className="w-full h-auto"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center bg-gray-900 rounded-3xl p-12 text-white">
            <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Download Agent Base and start seeing the bigger picture of your AI-powered
              development.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="gap-2 px-8 bg-white text-gray-900 hover:bg-gray-100">
                <Download className="w-5 h-5" />
                Download Now
              </Button>
              <a
                href="https://github.com/AgentOrchestrator/AgentBase"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 px-8 border-gray-700 text-white hover:bg-gray-800"
                >
                  <Github className="w-5 h-5" />
                  View on GitHub
                </Button>
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Image
              src="/logo-white.png"
              alt="Agent Base"
              width={80}
              height={24}
              className="h-4 w-auto invert opacity-50"
            />
            <span>Built with care</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/AgentOrchestrator/AgentBase"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Github className="w-5 h-5" />
            </a>
            <a
              href="https://discord.gg/mb8q2rf8"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
