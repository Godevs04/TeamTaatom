"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
};

const OTP_LENGTH = 6;

export function OtpInput({ value, onChange, error, disabled }: OtpInputProps) {
  const inputRefs = React.useRef<Array<HTMLInputElement | null>>([]);
  const digits = React.useMemo(() => {
    const arr = value.replace(/\D/g, "").slice(0, OTP_LENGTH).split("");
    while (arr.length < OTP_LENGTH) arr.push("");
    return arr;
  }, [value]);

  const focusIndex = (index: number) => {
    inputRefs.current[index]?.focus();
    inputRefs.current[index]?.select();
  };

  const updateAt = (index: number, char: string) => {
    const next = [...digits];
    next[index] = char;
    onChange(next.join("").replace(/\D/g, "").slice(0, OTP_LENGTH));
  };

  const handleChange = (index: number, text: string) => {
    const digit = text.replace(/\D/g, "").slice(-1);
    updateAt(index, digit);
    if (digit && index < OTP_LENGTH - 1) focusIndex(index + 1);
  };

  const handleKeyDown = (index: number, key: string) => {
    if (key === "Backspace" && !digits[index] && index > 0) {
      focusIndex(index - 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    onChange(pasted);
    focusIndex(Math.min(pasted.length, OTP_LENGTH - 1));
  };

  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold">Enter 6-digit OTP</label>
      <div className="flex justify-center gap-2 sm:gap-2.5" onPaste={handlePaste}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={digit}
            disabled={disabled}
            autoFocus={index === 0}
            aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
            className={cn(
              "h-12 w-10 rounded-xl border bg-slate-50/80 text-center text-lg font-semibold tabular-nums outline-none transition-colors sm:h-14 sm:w-12",
              error ? "border-destructive" : "border-slate-200/90 focus:border-primary focus:ring-2 focus:ring-primary/20",
              digit && "border-primary/40 bg-white"
            )}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e.key)}
          />
        ))}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
