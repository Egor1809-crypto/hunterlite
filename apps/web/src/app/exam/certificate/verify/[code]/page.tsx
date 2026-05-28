"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Award,
  CheckCircle,
  XCircle,
  Loader2,
  Shield,
  Calendar,
  BarChart3,
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/public-origin";

interface CertificatePublic {
  user_name: string;
  exam_title: string;
  score_percent: number;
  issued_at: string;
  certificate_code: string;
}

export default function CertificateVerifyPage() {
  const params = useParams();
  const code = params.code as string;

  const [cert, setCert] = useState<CertificatePublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`${getApiBaseUrl()}/api/exams/certificate/${encodeURIComponent(code)}`)
      .then((res) => {
        if (!res.ok) {
          setNotFound(true);
          setLoading(false);
          return null;
        }
        return res.json();
      })
      .then((data: CertificatePublic | null) => {
        if (data) {
          setCert(data);
          setLoading(false);
        }
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [code]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#0a0a0f" }}
      >
        <div className="text-center">
          <Loader2
            size={32}
            className="animate-spin mx-auto mb-4"
            style={{ color: "#F59E0B" }}
          />
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            Проверка сертификата...
          </p>
        </div>
      </div>
    );
  }

  if (notFound || !cert) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#0a0a0f" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm px-6"
        >
          <div
            className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-6"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "2px solid rgba(239,68,68,0.2)",
            }}
          >
            <XCircle size={36} style={{ color: "#EF4444" }} />
          </div>
          <h1
            className="text-xl font-bold mb-2"
            style={{ color: "rgba(255,255,255,0.9)" }}
          >
            Сертификат не найден
          </h1>
          <p className="text-sm mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
            Код верификации недействителен или не существует.
          </p>
          <code
            className="text-xs font-mono px-3 py-1.5 rounded-lg inline-block"
            style={{
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.4)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {code}
          </code>
        </motion.div>
      </div>
    );
  }

  const issuedDate = new Date(cert.issued_at).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen relative" style={{ background: "#0a0a0f" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes verifyPulse {
            0%, 100% { box-shadow: 0 0 20px rgba(34,197,94,0.1); }
            50% { box-shadow: 0 0 40px rgba(34,197,94,0.2); }
          }
        `,
        }}
      />

      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div
          className="absolute -top-40 right-[15%] rounded-full opacity-[0.04]"
          style={{
            width: 600,
            height: 600,
            background: "radial-gradient(circle, #F59E0B 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-[50%] -left-20 rounded-full opacity-[0.03]"
          style={{
            width: 400,
            height: 400,
            background: "radial-gradient(circle, #22C55E 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative z-10 max-w-[500px] mx-auto px-5 sm:px-8 py-12 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4"
              style={{
                background: "rgba(34,197,94,0.08)",
                border: "2px solid rgba(34,197,94,0.25)",
                animation: "verifyPulse 3s ease-in-out infinite",
              }}
            >
              <Shield size={28} style={{ color: "#22C55E" }} />
            </div>
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-3"
              style={{
                background: "rgba(34,197,94,0.08)",
                border: "1.5px solid rgba(34,197,94,0.2)",
              }}
            >
              <CheckCircle size={14} style={{ color: "#22C55E" }} />
              <span className="text-xs font-bold" style={{ color: "#22C55E" }}>
                Сертификат действителен
              </span>
            </div>
          </div>

          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background:
                "linear-gradient(160deg, rgba(245,158,11,0.05) 0%, rgba(255,255,255,0.02) 40%, rgba(245,158,11,0.03) 100%)",
              border: "1.5px solid rgba(245,158,11,0.15)",
            }}
          >
            <div
              className="h-1"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(245,158,11,0.4), #F59E0B, rgba(245,158,11,0.4), transparent)",
              }}
            />

            <div className="p-7 sm:p-9">
              <div className="text-center mb-7">
                <div
                  className="w-14 h-14 rounded-xl mx-auto flex items-center justify-center mb-3"
                  style={{
                    background: "rgba(245,158,11,0.1)",
                    border: "1.5px solid rgba(245,158,11,0.25)",
                  }}
                >
                  <Award size={26} style={{ color: "#F59E0B" }} />
                </div>
                <div
                  className="text-[10px] font-bold uppercase tracking-[0.15em] mb-1"
                  style={{ color: "#F59E0B" }}
                >
                  HunterLite
                </div>
                <h1
                  className="text-lg font-bold"
                  style={{ color: "rgba(255,255,255,0.9)" }}
                >
                  {cert.exam_title}
                </h1>
              </div>

              <div className="space-y-4">
                <div
                  className="p-4 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    Владелец
                  </div>
                  <div
                    className="text-base font-bold"
                    style={{ color: "rgba(255,255,255,0.9)" }}
                  >
                    {cert.user_name}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="p-4 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <BarChart3
                      size={14}
                      className="mb-2"
                      style={{ color: "#F59E0B" }}
                    />
                    <div
                      className="text-2xl font-bold"
                      style={{ color: "#F59E0B" }}
                    >
                      {cert.score_percent}%
                    </div>
                    <div
                      className="text-[10px] mt-0.5"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      Результат
                    </div>
                  </div>

                  <div
                    className="p-4 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <Calendar
                      size={14}
                      className="mb-2"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                    />
                    <div
                      className="text-sm font-bold"
                      style={{ color: "rgba(255,255,255,0.9)" }}
                    >
                      {issuedDate}
                    </div>
                    <div
                      className="text-[10px] mt-0.5"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      Дата выдачи
                    </div>
                  </div>
                </div>

                <div
                  className="p-4 rounded-xl text-center"
                  style={{
                    background: "rgba(245,158,11,0.04)",
                    border: "1px solid rgba(245,158,11,0.1)",
                  }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider mb-1"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    Код верификации
                  </div>
                  <code
                    className="text-sm font-mono font-bold"
                    style={{ color: "#F59E0B" }}
                  >
                    {cert.certificate_code}
                  </code>
                </div>
              </div>
            </div>

            <div
              className="h-0.5"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(245,158,11,0.2), transparent)",
              }}
            />
          </div>

          <div className="text-center mt-6">
            <p
              className="text-[11px]"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Сертификат выдан платформой HunterLite (ФЗ-127)
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
