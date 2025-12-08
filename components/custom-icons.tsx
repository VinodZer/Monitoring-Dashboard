import React from 'react'

interface IconProps {
  className?: string
  size?: number
}

export const CustomMarketIcon: React.FC<IconProps> = ({ className = "", size = 24 }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path
      d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"
      style={{ backgroundColor: "rgba(255, 255, 255, 1)" }}
    />
  </svg>
)

// Example of using an external SVG file
export const FileBasedIcon: React.FC<IconProps> = ({ className = "", size = 24 }) => (
  <img 
    src="/custom-logo.svg" 
    alt="Custom Logo"
    className={className}
    width={size}
    height={size}
  />
)
