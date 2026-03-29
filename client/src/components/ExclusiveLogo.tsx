interface ExclusiveLogoProps {
  className?: string;
  variant?: 'full' | 'icon';
}

export default function ExclusiveLogo({ className = 'h-10 w-auto', variant = 'full' }: ExclusiveLogoProps) {
  if (variant === 'icon') {
    return (
      <svg
        className={className}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Exclusive logo"
      >
        <rect width="40" height="40" rx="4" fill="#DC143C" />
        <text
          x="20"
          y="27"
          textAnchor="middle"
          fill="white"
          fontSize="20"
          fontWeight="bold"
          fontFamily="Arial, sans-serif"
          letterSpacing="-1"
        >
          E
        </text>
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox="0 0 200 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Exclusive Mobile Home Transport logo"
    >
      {/* Icon block */}
      <rect x="0" y="4" width="40" height="40" rx="4" fill="#DC143C" />
      <text
        x="20"
        y="31"
        textAnchor="middle"
        fill="white"
        fontSize="24"
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
      >
        E
      </text>

      {/* Brand name */}
      <text
        x="50"
        y="22"
        fill="#DC143C"
        fontSize="18"
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
        letterSpacing="1"
      >
        EXCLUSIVE
      </text>
      <text
        x="50"
        y="38"
        fill="#ffffff"
        fontSize="9"
        fontFamily="Arial, sans-serif"
        letterSpacing="2"
        opacity="0.7"
      >
        MOBILE HOME TRANSPORT
      </text>
    </svg>
  );
}
