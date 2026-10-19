"use client";

import { useEffect, useState } from "react";

export function CopyrightYear() {
  const [year, setYear] = useState("2026");

  useEffect(() => {
    setYear(String(new Date().getFullYear()));
  }, []);

  return <span suppressHydrationWarning>{year}</span>;
}