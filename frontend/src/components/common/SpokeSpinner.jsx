import React from 'react';

/**
 * Radial Spoke Spinner matching 12-spoke rounded pill design
 * Rotates smoothly in a circle while submitting / loading.
 */
export default function SpokeSpinner({ size = 18, className = '', color = 'currentColor' }) {
  const spokes = [
    { angle: 0, opacity: 1.0 },
    { angle: 30, opacity: 0.92 },
    { angle: 60, opacity: 0.84 },
    { angle: 90, opacity: 0.76 },
    { angle: 120, opacity: 0.68 },
    { angle: 150, opacity: 0.60 },
    { angle: 180, opacity: 0.52 },
    { angle: 210, opacity: 0.44 },
    { angle: 240, opacity: 0.36 },
    { angle: 270, opacity: 0.28 },
    { angle: 300, opacity: 0.20 },
    { angle: 330, opacity: 0.12 },
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`inline-block animate-spin shrink-0 ${className}`}
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      style={{ animationDuration: '0.85s' }}
      aria-hidden="true"
    >
      {spokes.map((s, idx) => (
        <rect
          key={idx}
          x="46"
          y="6"
          width="8"
          height="22"
          rx="4"
          ry="4"
          opacity={s.opacity}
          transform={`rotate(${s.angle} 50 50)`}
        />
      ))}
    </svg>
  );
}

export function SubmitButton({
  loading = false,
  loadingText = 'Submitting...',
  children,
  disabled = false,
  className = '',
  spinnerSize = 16,
  type = 'submit',
  onClick,
  ...props
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 transition-all select-none disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {loading && <SpokeSpinner size={spinnerSize} />}
      <span>{loading ? loadingText : children}</span>
    </button>
  );
}
