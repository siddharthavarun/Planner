import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

const base = (props: P) => ({
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
});

export const PlusIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 3v10M3 8h10" />
  </svg>
);
export const ChevronIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 4l4 4-4 4" />
  </svg>
);
export const DotsIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <circle cx="3.5" cy="8" r="1.3" />
    <circle cx="8" cy="8" r="1.3" />
    <circle cx="12.5" cy="8" r="1.3" />
  </svg>
);
export const GripIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <circle cx="6" cy="4" r="1.2" />
    <circle cx="10" cy="4" r="1.2" />
    <circle cx="6" cy="8" r="1.2" />
    <circle cx="10" cy="8" r="1.2" />
    <circle cx="6" cy="12" r="1.2" />
    <circle cx="10" cy="12" r="1.2" />
  </svg>
);
export const TrashIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />
  </svg>
);
export const CopyIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 5.5V3.5a1 1 0 00-1-1h-6a1 1 0 00-1 1v6a1 1 0 001 1h2" />
  </svg>
);
export const ArrowUpIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 13V3M4 7l4-4 4 4" />
  </svg>
);
export const ArrowDownIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 3v10M4 9l4 4 4-4" />
  </svg>
);
export const MoveIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 8h9M9 5l3 3-3 3M13.5 3v10" />
  </svg>
);
export const SidebarIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <path d="M6 3v10" />
  </svg>
);
export const SearchIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </svg>
);
export const ImageIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <circle cx="6" cy="6.5" r="1.2" />
    <path d="M14 11l-3.5-3.5L4 13" />
  </svg>
);
export const SmileIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="6" />
    <path d="M5.8 9.5c.6.8 1.3 1.2 2.2 1.2s1.6-.4 2.2-1.2M6 6.5h.01M10 6.5h.01" />
  </svg>
);
export const CalendarIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
    <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
  </svg>
);
export const ClockIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.5V8l2.5 1.5" />
  </svg>
);
export const FlagIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 14V2.5M3.5 3h8l-1.5 3 1.5 3h-8" />
  </svg>
);
export const StatusIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 2a6 6 0 010 12z" fill="currentColor" />
  </svg>
);
export const ProgressIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.5 12.5l4-4 2.5 2.5 4.5-5.5" />
  </svg>
);
export const DownloadIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10" />
  </svg>
);
export const UploadIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 10.5v-8M4.5 6L8 2.5 11.5 6M3 13.5h10" />
  </svg>
);
export const SunIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
  </svg>
);
export const MoonIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M13.5 9.5A5.5 5.5 0 016.5 2.5a5.5 5.5 0 107 7z" />
  </svg>
);
export const BackIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M10 3L5 8l5 5" />
  </svg>
);
export const CloseIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);
