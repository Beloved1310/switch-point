"use client";

import { useEffect, useState } from "react";

/** Formats in the viewer's locale after mount, avoiding a hydration mismatch. */
export function LocalTime({ iso, time = false }: { iso: string; time?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const d = new Date(iso);
    setText(time ? d.toLocaleTimeString() : d.toLocaleString());
  }, [iso, time]);
  return <time dateTime={iso}>{text ?? ""}</time>;
}
