"use client";
import Image from "next/image";
import { useState } from "react";

export function ClientPortrait({
  name,
  src,
  size = 56,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="client-portrait" style={{ width: size, height: size }}>
      {src && !failed ? (
        <Image
          src={src}
          alt={`Учебный клиент ${name}`}
          width={size}
          height={size}
          sizes={`${size}px`}
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-label={name}>
          {name
            .split(" ")
            .slice(0, 2)
            .map((n) => n[0])
            .join("")}
        </span>
      )}
    </span>
  );
}
