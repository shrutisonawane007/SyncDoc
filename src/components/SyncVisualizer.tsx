'use client';

import React from 'react';

export default function SyncVisualizer() {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden select-none bg-slate-50/50">
      {/* Background Grid Pattern */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(244, 245, 247, 1)" strokeWidth="1" />
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(226, 232, 240, 0.4)" strokeWidth="0.5" />
          </pattern>
          <linearGradient id="grid-fade" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(249, 115, 22, 0.05)" />
            <stop offset="50%" stopColor="rgba(255, 255, 255, 0)" />
            <stop offset="100%" stopColor="rgba(148, 163, 184, 0.08)" />
          </linearGradient>
          {/* Neon Glow Filter */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-strong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Fill background with grid */}
        <rect width="100%" height="100%" fill="url(#grid)" />
        <rect width="100%" height="100%" fill="url(#grid-fade)" />
      </svg>

      {/* SVG Animation Network Overlay */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 1000" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Connection Paths */}
        {/* Path 1: Client Node to local DB */}
        <path
          d="M 150,220 C 150,290 190,320 290,320"
          stroke="#e2e8f0"
          strokeWidth="2.5"
          strokeDasharray="4 4"
        />
        
        {/* Path 2: Client to Cloud Sync Node */}
        <path
          d="M 150,220 C 150,150 250,120 400,120"
          stroke="#e2e8f0"
          strokeWidth="2"
          strokeDasharray="6 4"
        />

        {/* Path 3: Offline Sync Stream line */}
        <path
          id="sync-stream-line"
          d="M 400,120 C 550,120 650,170 650,250 C 650,330 550,380 400,380"
          stroke="rgba(249, 115, 22, 0.15)"
          strokeWidth="3"
        />

        {/* Path 4: Conflict Resolution Split Branches converging */}
        <path
          d="M 200,550 C 270,550 280,600 350,600"
          stroke="#e2e8f0"
          strokeWidth="2"
        />
        <path
          d="M 200,650 C 270,650 280,600 350,600"
          stroke="#e2e8f0"
          strokeWidth="2"
        />
        <path
          d="M 350,600 L 520,600"
          stroke="rgba(249, 115, 22, 0.2)"
          strokeWidth="3"
        />

        {/* Flow Particles (Syncing animations) */}
        {/* Particle flowing to local DB */}
        <circle r="4" fill="#f97316" filter="url(#glow)">
          <animateMotion
            dur="4s"
            repeatCount="indefinite"
            path="M 150,220 C 150,290 190,320 290,320"
          />
        </circle>

        {/* Particle flowing to Server Cloud */}
        <circle r="4" fill="#f97316" filter="url(#glow)">
          <animateMotion
            dur="6s"
            repeatCount="indefinite"
            path="M 150,220 C 150,150 250,120 400,120"
          />
        </circle>

        {/* Continuous sync stream loop */}
        <circle r="5" fill="#f97316" filter="url(#glow-strong)">
          <animateMotion
            dur="7s"
            repeatCount="indefinite"
            path="M 400,120 C 550,120 650,170 650,250 C 650,330 550,380 400,380"
          />
        </circle>
        
        <circle r="3" fill="#94a3b8">
          <animateMotion
            dur="7s"
            begin="2.3s"
            repeatCount="indefinite"
            path="M 400,120 C 550,120 650,170 650,250 C 650,330 550,380 400,380"
          />
        </circle>

        {/* Conflict Resolution branch particles */}
        <circle r="4" fill="#ef4444" filter="url(#glow)">
          <animateMotion
            dur="4.5s"
            repeatCount="indefinite"
            path="M 200,550 C 270,550 280,600 350,600"
          />
        </circle>
        <circle r="4" fill="#10b981" filter="url(#glow)">
          <animateMotion
            dur="4.5s"
            begin="1.5s"
            repeatCount="indefinite"
            path="M 200,650 C 270,650 280,600 350,600"
          />
        </circle>

        {/* Resolved particle moving from junction */}
        <circle r="5" fill="#f97316" filter="url(#glow-strong)">
          <animateMotion
            dur="4.5s"
            begin="3s"
            repeatCount="indefinite"
            path="M 350,600 L 520,600"
          />
        </circle>

        {/* Node visual details */}
        {/* Node 1: Client device node wrapper */}
        <g className="animate-[pulse_3s_infinite]">
          <circle cx="150" cy="220" r="16" fill="rgba(255,255,255,0.9)" stroke="#cbd5e1" strokeWidth="1.5" />
          <circle cx="150" cy="220" r="8" fill="#f97316" filter="url(#glow)" />
        </g>
        
        {/* Node 2: Local IndexedDB database cylinder graphic */}
        <g>
          <rect x="290" y="295" width="40" height="50" rx="6" fill="rgba(255,255,255,0.95)" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="290" y1="310" x2="330" y2="310" stroke="#e2e8f0" strokeWidth="1.5" />
          <line x1="290" y1="322" x2="330" y2="322" stroke="#e2e8f0" strokeWidth="1.5" />
          <line x1="290" y1="334" x2="330" y2="334" stroke="#e2e8f0" strokeWidth="1.5" />
          {/* Storage Pulsing Green light */}
          <circle cx="310" cy="303" r="3" fill="#10b981" className="animate-ping" />
          <circle cx="310" cy="303" r="3" fill="#10b981" />
        </g>

        {/* Node 3: Cloud / Server Node */}
        <g>
          <circle cx="400" cy="120" r="22" fill="rgba(255,255,255,0.95)" stroke="#cbd5e1" strokeWidth="1.5" />
          <path d="M392,126 C388,124 388,118 393,115 C392,110 397,107 402,109 C405,105 412,107 413,112 C417,112 418,118 414,121 C416,125 411,128 406,127 C402,129 395,129 392,126 Z" fill="#e2e8f0" />
          <circle cx="400" cy="120" r="12" fill="none" stroke="#f97316" strokeWidth="2" strokeDasharray="3 2" className="animate-[spin_10s_linear_infinite]" />
        </g>

        {/* Node 4: Conflict Resolution Junction */}
        {/* Concurrent edits: User A (Red) and User B (Green) */}
        <g>
          {/* User A Node */}
          <circle cx="200" cy="550" r="10" fill="rgba(255,255,255,0.9)" stroke="#cbd5e1" strokeWidth="1" />
          <circle cx="200" cy="550" r="4" fill="#ef4444" />
          <text x="150" y="554" fill="#64748b" className="text-[10px] font-mono font-semibold">EDIT A</text>

          {/* User B Node */}
          <circle cx="200" cy="650" r="10" fill="rgba(255,255,255,0.9)" stroke="#cbd5e1" strokeWidth="1" />
          <circle cx="200" cy="650" r="4" fill="#10b981" />
          <text x="150" y="654" fill="#64748b" className="text-[10px] font-mono font-semibold">EDIT B</text>

          {/* Conflict Resolution Center Node */}
          <circle cx="350" cy="600" r="18" fill="rgba(255,255,255,0.95)" stroke="#cbd5e1" strokeWidth="1.5" />
          {/* Lamport LWW merge indicator symbol */}
          <path d="M 345,600 L 355,600 M 350,595 L 350,605" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
          <circle cx="350" cy="600" r="24" fill="none" stroke="#f97316" strokeWidth="1" strokeDasharray="2 4" className="animate-[spin_12s_linear_infinite]" />

          {/* Resolved output node */}
          <circle cx="520" cy="600" r="14" fill="rgba(255,255,255,0.95)" stroke="#cbd5e1" strokeWidth="1.5" />
          <path d="M 515,600 L 518,603 L 526,595" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <text x="545" y="604" fill="#10b981" className="text-[10px] font-mono font-bold tracking-wider">RESOLVED (LWW)</text>
        </g>

        {/* Section: Time Travel & Timeline Visual (Right vertical strip) */}
        <g>
          {/* Vertical Timeline rail */}
          <line x1="680" y1="480" x2="680" y2="820" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />
          
          {/* Moving timeline cursor representing time travel */}
          <g>
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,480; 0,820; 0,480"
              keyTimes="0; 0.5; 1"
              dur="12s"
              repeatCount="indefinite"
              additive="sum"
            />
            <line x1="660" y1="0" x2="700" y2="0" stroke="#f97316" strokeWidth="2.5" />
            <circle cx="680" cy="0" r="6" fill="#f97316" filter="url(#glow-strong)" />
          </g>

          {/* Timeline dots (Snapshots) */}
          {/* Snapshot v1 */}
          <g>
            <circle cx="680" cy="510" r="8" fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
            <circle cx="680" cy="510" r="4" fill="#94a3b8" />
            <text x="700" y="514" fill="#64748b" className="text-[10px] font-mono font-semibold">v1.0.0</text>
          </g>
          
          {/* Snapshot v2 */}
          <g>
            <circle cx="680" cy="610" r="8" fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
            <circle cx="680" cy="610" r="4" fill="#94a3b8" />
            <text x="700" y="614" fill="#64748b" className="text-[10px] font-mono font-semibold">v1.1.2</text>
          </g>

          {/* Snapshot v3 */}
          <g>
            <circle cx="680" cy="710" r="8" fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
            <circle cx="680" cy="710" r="4" fill="#94a3b8" />
            <text x="700" y="714" fill="#64748b" className="text-[10px] font-mono font-semibold">v1.2.0</text>
          </g>

          {/* Snapshot v4 (Active/Latest) */}
          <g>
            <circle cx="680" cy="800" r="10" fill="white" stroke="#f97316" strokeWidth="2" className="animate-[pulse_2s_infinite]" />
            <circle cx="680" cy="800" r="5" fill="#f97316" />
            <text x="700" y="804" fill="#f97316" className="text-[10px] font-mono font-bold">LATEST</text>
          </g>
        </g>

        {/* Ambient floating tech elements */}
        {/* Floating Code block shapes in background */}
        <g className="animate-[pulse_5s_infinite_ease-in-out]">
          <rect x="520" y="190" width="80" height="45" rx="4" fill="rgba(255,255,255,0.7)" stroke="#e2e8f0" strokeWidth="1" />
          <line x1="530" y1="202" x2="580" y2="202" stroke="#f97316" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          <line x1="530" y1="212" x2="590" y2="212" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
          <line x1="530" y1="222" x2="560" y2="222" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
        </g>

        <g className="animate-[pulse_6s_infinite_ease-in-out_1s]">
          <rect x="220" y="160" width="70" height="35" rx="4" fill="rgba(255,255,255,0.7)" stroke="#e2e8f0" strokeWidth="1" />
          <line x1="230" y1="172" x2="270" y2="172" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
          <line x1="230" y1="182" x2="260" y2="182" stroke="#f97316" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        </g>
      </svg>
    </div>
  );
}
