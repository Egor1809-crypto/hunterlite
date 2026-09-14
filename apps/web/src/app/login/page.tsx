"use client";
import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";
export default function LoginPage() {
  return <main className="auth-page"><Link className="auth-home" href="/">← На главную</Link><AuthCard standalone /></main>;
}
