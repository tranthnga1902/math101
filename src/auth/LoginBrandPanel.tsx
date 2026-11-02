import React from "react";

export function Math10Logo({ className = "w-10 h-10", markOnly = false }: { className?: string; markOnly?: boolean }) {
  return (
    <div className={`math10-logo-wrapper ${className}`}>
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="m10BookGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#48d39c" />
            <stop offset="50%" stopColor="#1bb380" />
            <stop offset="100%" stopColor="#0d855e" />
          </linearGradient>
          <linearGradient id="m10SpineGrad" x1="32" y1="12" x2="32" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#a7f3d0" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        {/* Left page */}
        <path
          d="M12 18C12 18 20 15 31 19V47C20 43 12 46 12 46V18Z"
          fill="url(#m10BookGrad)"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        {/* Right page */}
        <path
          d="M52 18C52 18 44 15 33 19V47C44 43 52 46 52 46V18Z"
          fill="url(#m10BookGrad)"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        {/* Book spine line */}
        <path
          d="M32 19V48"
          stroke="url(#m10SpineGrad)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Lower curve foundation */}
        <path
          d="M14 49C22 47 28 50 32 52C36 50 42 47 50 49"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function LoginBrandPanel() {
  return (
    <aside className="login-brand-panel" aria-label="Giới thiệu thương hiệu MATH10">
      {/* Subtle decorative dot grid at top right */}
      <div className="brand-dot-grid" aria-hidden="true" />

      {/* Decorative orbit ring */}
      <div className="brand-orbit-ring" aria-hidden="true" />

      <div className="brand-content">
        {/* Brand Header */}
        <div className="brand-header">
          <div className="brand-logo-row">
            <Math10Logo className="brand-logo-icon" />
            <span className="brand-name-text">MATH10</span>
          </div>
          <div className="brand-accent-bar" aria-hidden="true" />
        </div>

        {/* Brand Slogan */}
        <div className="brand-slogan-wrap">
          <h1 className="brand-slogan">
            <span>Kiến tạo</span>
            <span>hành trình</span>
            <span>học tập tốt hơn</span>
          </h1>
        </div>
      </div>

      {/* Bottom 3D Educational Visual */}
      <div className="brand-visual-container" aria-hidden="true">
        <img
          src="/login-visual.png"
          alt=""
          className="brand-visual-img"
          loading="eager"
          decoding="async"
        />
      </div>
    </aside>
  );
}
