/**
 * One icon system: 20×20 grid, 1.6 stroke, round caps, currentColor.
 * Hand-drawn rather than a dependency — keeps the bundle small and the weight
 * consistent across every icon in the product.
 */
type P = { className?: string; size?: number };
const base = (size: number) => ({
  width: size, height: size, viewBox: '0 0 20 20', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const Icon = {
  Overview: ({ className, size = 18 }: P) => (<svg {...base(size)} className={className}><path d="M3 10.5 10 4l7 6.5"/><path d="M5 9.5V16h10V9.5"/><path d="M8.2 16v-3.4h3.6V16"/></svg>),
  Orders: ({ className, size = 18 }: P) => (<svg {...base(size)} className={className}><path d="M5.5 3h9l1.5 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 15.5v-9Z"/><path d="M4 6.5h12"/><path d="M7.6 9.4a2.4 2.4 0 0 0 4.8 0"/></svg>),
  Payments: ({ className, size = 18 }: P) => (<svg {...base(size)} className={className}><rect x="2.6" y="5" width="14.8" height="10" rx="2"/><path d="M2.6 8.6h14.8"/><path d="M5.6 12.2h3"/></svg>),
  Customers: ({ className, size = 18 }: P) => (<svg {...base(size)} className={className}><circle cx="8" cy="7.4" r="2.6"/><path d="M3.2 16c.5-2.4 2.4-3.8 4.8-3.8s4.3 1.4 4.8 3.8"/><path d="M13.4 5.2a2.4 2.4 0 0 1 0 4.5"/><path d="M14.6 12.5c1.3.5 2.1 1.7 2.4 3.5"/></svg>),
  Analytics: ({ className, size = 18 }: P) => (<svg {...base(size)} className={className}><path d="M3 16.4h14"/><path d="M5.6 13.4V9"/><path d="M9.4 13.4V5.4"/><path d="M13.2 13.4v-5"/></svg>),
  Agent: ({ className, size = 18 }: P) => (<svg {...base(size)} className={className}><rect x="4" y="6.6" width="12" height="8.4" rx="2.2"/><path d="M10 6.6V4"/><circle cx="10" cy="3.1" r="1.1"/><path d="M7.6 10.2v1.4M12.4 10.2v1.4"/><path d="M1.8 10.6v2.6M18.2 10.6v2.6"/></svg>),
  Products: ({ className, size = 18 }: P) => (<svg {...base(size)} className={className}><path d="M10 2.8 17 6.4v7.2L10 17.2 3 13.6V6.4Z"/><path d="m3 6.4 7 3.6 7-3.6"/><path d="M10 10v7.2"/></svg>),
  Campaigns: ({ className, size = 18 }: P) => (<svg {...base(size)} className={className}><path d="M4 8.4v3.2a1.6 1.6 0 0 0 1.6 1.6h1L9 16.6V3.4L6.6 6.8h-1A1.6 1.6 0 0 0 4 8.4Z"/><path d="M12 7.2a3.6 3.6 0 0 1 0 5.6"/><path d="M14.4 5a6.4 6.4 0 0 1 0 10"/></svg>),
  Settings: ({ className, size = 18 }: P) => (<svg {...base(size)} className={className}><circle cx="10" cy="10" r="2.6"/><path d="M10 2.6v1.8M10 15.6v1.8M17.4 10h-1.8M4.4 10H2.6M15.2 4.8l-1.3 1.3M6.1 13.9l-1.3 1.3M15.2 15.2l-1.3-1.3M6.1 6.1 4.8 4.8"/></svg>),
  Search: ({ className, size = 18 }: P) => (<svg {...base(size)} className={className}><circle cx="9" cy="9" r="5.2"/><path d="m12.9 12.9 3.4 3.4"/></svg>),
  Bell: ({ className, size = 18 }: P) => (<svg {...base(size)} className={className}><path d="M5.6 8.4a4.4 4.4 0 1 1 8.8 0c0 3 .9 4.3 1.4 4.9H4.2c.5-.6 1.4-1.9 1.4-4.9Z"/><path d="M8.4 15.8a1.8 1.8 0 0 0 3.2 0"/></svg>),
  Sun: ({ className, size = 18 }: P) => (<svg {...base(size)} className={className}><circle cx="10" cy="10" r="3.4"/><path d="M10 2.4v1.8M10 15.8v1.8M17.6 10h-1.8M4.2 10H2.4M15.4 4.6l-1.3 1.3M5.9 14.1l-1.3 1.3M15.4 15.4l-1.3-1.3M5.9 5.9 4.6 4.6"/></svg>),
  Moon: ({ className, size = 18 }: P) => (<svg {...base(size)} className={className}><path d="M16 11.4A6.6 6.6 0 0 1 8.6 4a6.6 6.6 0 1 0 7.4 7.4Z"/></svg>),
  Up: ({ className, size = 14 }: P) => (<svg {...base(size)} className={className}><path d="M10 15.5V5"/><path d="m5.6 9 4.4-4.4L14.4 9"/></svg>),
  Down: ({ className, size = 14 }: P) => (<svg {...base(size)} className={className}><path d="M10 4.5V15"/><path d="m5.6 11 4.4 4.4L14.4 11"/></svg>),
  Chevron: ({ className, size = 16 }: P) => (<svg {...base(size)} className={className}><path d="m7.6 4.8 4.8 5.2-4.8 5.2"/></svg>),
  Close: ({ className, size = 18 }: P) => (<svg {...base(size)} className={className}><path d="m5.5 5.5 9 9M14.5 5.5l-9 9"/></svg>),
  Check: ({ className, size = 16 }: P) => (<svg {...base(size)} className={className}><path d="m4.6 10.4 3.2 3.2 7.6-7.6"/></svg>),
  Refresh: ({ className, size = 16 }: P) => (<svg {...base(size)} className={className}><path d="M16.2 8.4A6.4 6.4 0 0 0 5 6"/><path d="M3.8 11.6A6.4 6.4 0 0 0 15 14"/><path d="M4.6 3v3.2h3.2M15.4 17v-3.2h-3.2"/></svg>),
  Download: ({ className, size = 16 }: P) => (<svg {...base(size)} className={className}><path d="M10 3v8.6"/><path d="m6.4 8.4 3.6 3.6 3.6-3.6"/><path d="M4 14.6v1.2a1.2 1.2 0 0 0 1.2 1.2h9.6a1.2 1.2 0 0 0 1.2-1.2v-1.2"/></svg>),
  Plus: ({ className, size = 16 }: P) => (<svg {...base(size)} className={className}><path d="M10 4.6v10.8M4.6 10h10.8"/></svg>),
  Refund: ({ className, size = 16 }: P) => (<svg {...base(size)} className={className}><path d="M8.4 4.6 4.6 8.4l3.8 3.8"/><path d="M4.6 8.4h7.2a3.6 3.6 0 0 1 0 7.2H8.4"/></svg>),
  External: ({ className, size = 14 }: P) => (<svg {...base(size)} className={className}><path d="M11.4 4.2h4.4v4.4"/><path d="m15.8 4.2-6 6"/><path d="M14 12v3.2a1.2 1.2 0 0 1-1.2 1.2H5a1.2 1.2 0 0 1-1.2-1.2V7.4A1.2 1.2 0 0 1 5 6.2h3.2"/></svg>),
  Alert: ({ className, size = 16 }: P) => (<svg {...base(size)} className={className}><path d="M10 3.4 17 15.6H3Z"/><path d="M10 8v3.2M10 13.6v.6"/></svg>),
  Shield: ({ className, size = 16 }: P) => (<svg {...base(size)} className={className}><path d="M10 2.8 4.4 5v4.4c0 3.3 2.3 6.3 5.6 7.4 3.3-1.1 5.6-4.1 5.6-7.4V5Z"/><path d="m7.6 9.8 1.8 1.8 3.2-3.4"/></svg>),
  Sparkle: ({ className, size = 16 }: P) => (<svg {...base(size)} className={className}><path d="M10 3.2 11.5 8 16 9.5 11.5 11 10 15.8 8.5 11 4 9.5 8.5 8Z"/><path d="M15.4 3.4v2.2M16.5 4.5h-2.2"/></svg>),
  Menu: ({ className, size = 18 }: P) => (<svg {...base(size)} className={className}><path d="M3.4 6h13.2M3.4 10h13.2M3.4 14h13.2"/></svg>),
};

export type IconName = keyof typeof Icon;
