import React from 'react';

const sizes = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
};

export default function AiAvatar({ size = 'sm', active = false, className = '', decorative = false }) {
  return <span className={`aapm-ai-avatar ${active ? 'aapm-ai-avatar--active' : ''} ${sizes[size] || sizes.sm} ${className}`} aria-hidden={decorative || undefined}>
    <span className="aapm-ai-avatar__halo" />
    <img src="/assets/aapm-ai-mascot.png" alt={decorative ? '' : 'Maskot AI AAPM'} className="aapm-ai-avatar__image" />
  </span>;
}
