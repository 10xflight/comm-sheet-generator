import React from 'react';

export const HeadsetIcon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 11a8 8 0 0 1 16 0" />
    <rect x="2" y="10" width="4" height="7" rx="1" />
    <rect x="18" y="10" width="4" height="7" rx="1" />
    <path d="M18 14 Q17 17 14 18" />
    <ellipse cx="12" cy="19" rx="2.5" ry="1.5" />
  </svg>
);
