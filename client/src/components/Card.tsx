import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: boolean;
}

export default function Card({ children, className = '', accent = false, ...props }: CardProps) {
  return (
    <div
      className={`bg-exclusive-black-card border ${accent ? 'border-exclusive-red' : 'border-exclusive-black-border'} rounded-xl p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
