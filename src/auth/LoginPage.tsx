import React from "react";
import type { AuthSession } from "../api";
import { LoginBrandPanel } from "./LoginBrandPanel";
import { LoginForm } from "./LoginForm";
import "./login.css";

interface LoginPageProps {
  onLogin: (session: AuthSession) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  return (
    <main className="login-page-wrapper">
      <div className="login-card-container">
        <LoginBrandPanel />
        <LoginForm onLogin={onLogin} />
      </div>
    </main>
  );
}

export default LoginPage;
