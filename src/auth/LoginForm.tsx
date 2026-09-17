import React, { useState, useEffect } from "react";
import { User, Lock, Eye, EyeOff, Loader2, ArrowRight, Info, X } from "lucide-react";
import { login, type AuthSession } from "../api";
import { Math10Logo } from "./LoginBrandPanel";

interface LoginFormProps {
  onLogin: (session: AuthSession) => void;
}

const REMEMBER_KEY = "math10.remembered_identifier";

export function LoginForm({ onLogin }: LoginFormProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [showForgotNotice, setShowForgotNotice] = useState(false);

  // Load remembered username/email on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setIdentifier(saved);
        setRememberMe(true);
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, []);

  const validate = () => {
    const errors: { identifier?: string; password?: string } = {};
    const trimmedId = identifier.trim();
    if (!trimmedId) {
      errors.identifier = "Vui lòng nhập email hoặc số điện thoại.";
    }
    if (!password) {
      errors.password = "Vui lòng nhập mật khẩu.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");

    if (!validate()) {
      return;
    }

    setBusy(true);
    try {
      const trimmedId = identifier.trim();
      const session = await login(trimmedId, password);

      // Handle remember me
      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, trimmedId);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      onLogin(session);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đăng nhập thất bại";
      if (msg.includes("401") || msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("mật khẩu") || msg.toLowerCase().includes("tài khoản")) {
        setErrorMessage("Email hoặc mật khẩu không chính xác.");
      } else {
        setErrorMessage(msg || "Email hoặc mật khẩu không chính xác.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="login-form-panel" aria-label="Khung đăng nhập">
      <div className="login-form-inner">
        {/* Top Header */}
        <div className="form-header">
          <div className="form-brand-mark">
            <Math10Logo className="form-logo-icon" markOnly />
          </div>
          <h2 className="form-title">Đăng nhập</h2>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="form-error-banner" role="alert">
            <span className="error-bullet" aria-hidden="true">•</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Forgot password notice dialog / banner */}
        {showForgotNotice && (
          <div className="form-info-banner" role="status">
            <Info size={16} className="info-icon" aria-hidden="true" />
            <div className="info-text">
              Tài khoản hệ thống do Quản trị viên cấp. Vui lòng liên hệ Văn phòng nhà trường hoặc Quản trị viên để đặt lại mật khẩu.
            </div>
            <button
              type="button"
              className="info-close-btn"
              onClick={() => setShowForgotNotice(false)}
              aria-label="Đóng thông báo"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {/* Field: Identifier */}
          <div className="form-group">
            <div className={`input-container ${fieldErrors.identifier ? "has-error" : ""}`}>
              <User className="field-icon" size={18} aria-hidden="true" />
              <input
                id="login-identifier"
                type="text"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (fieldErrors.identifier) {
                    setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
                  }
                }}
                placeholder="Email hoặc số điện thoại"
                autoComplete="username"
                disabled={busy}
                className="form-input"
                aria-invalid={Boolean(fieldErrors.identifier)}
                aria-describedby={fieldErrors.identifier ? "identifier-error" : undefined}
              />
            </div>
            {fieldErrors.identifier && (
              <p id="identifier-error" className="field-error-text">
                {fieldErrors.identifier}
              </p>
            )}
          </div>

          {/* Field: Password */}
          <div className="form-group">
            <div className={`input-container ${fieldErrors.password ? "has-error" : ""}`}>
              <Lock className="field-icon" size={18} aria-hidden="true" />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                placeholder="Mật khẩu"
                autoComplete="current-password"
                disabled={busy}
                className="form-input"
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? "password-error" : undefined}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={0}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.password && (
              <p id="password-error" className="field-error-text">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Options Row: Remember & Forgot Password */}
          <div className="form-options-row">
            <label className="remember-checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={busy}
                className="custom-checkbox"
              />
              <span className="remember-text">Ghi nhớ đăng nhập</span>
            </label>

            <button
              type="button"
              className="forgot-password-link"
              onClick={() => setShowForgotNotice(true)}
            >
              Quên mật khẩu?
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={busy}
            className="login-submit-button"
            aria-busy={busy}
          >
            {busy ? (
              <>
                <Loader2 className="button-spinner" size={18} aria-hidden="true" />
                <span>Đang đăng nhập...</span>
              </>
            ) : (
              <>
                <span>Đăng nhập</span>
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      </div>
    </section>
  );
}
