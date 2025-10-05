// components/PasswordGenerator.tsx
"use client";
import React, { useState } from "react";

type Props = {
  onGenerate: (pwd: string) => void;
  initialLength?: number;
};

const LOOK_ALIKES = ["l", "1", "I", "O", "0", "o"];

export default function PasswordGenerator({ onGenerate, initialLength = 16 }: Props) {
  const [length, setLength] = useState(initialLength);
  const [useLower, setUseLower] = useState(true);
  const [useUpper, setUseUpper] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [excludeLookAlikes, setExcludeLookAlikes] = useState(true);

  const alphLower = "abcdefghijklmnopqrstuvwxyz";
  const alphUpper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()-_=+[]{};:,.<>/?";

  function buildCharset() {
    let cs = "";
    if (useLower) cs += alphLower;
    if (useUpper) cs += alphUpper;
    if (useNumbers) cs += numbers;
    if (useSymbols) cs += symbols;
    if (excludeLookAlikes) {
      LOOK_ALIKES.forEach((ch) => (cs = cs.replace(new RegExp(ch, "g"), "")));
    }
    return cs;
  }

  function secureRandomBytes(n: number) {
    const arr = new Uint32Array(n);
    window.crypto.getRandomValues(arr);
    return arr;
  }

  function generate() {
    const charset = buildCharset();
    if (!charset) return onGenerate("");
    const bytes = secureRandomBytes(length);
    let out = "";
    for (let i = 0; i < length; i++) {
      out += charset[bytes[i] % charset.length];
    }
    onGenerate(out);
  }

  return (
    <div className="p-4 border rounded-md space-y-3 bg-white">
      <div className="flex items-center gap-4">
        <label className="font-medium">Length: {length}</label>
        <input
          type="range"
          min={8}
          max={64}
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
        />
        <button onClick={generate} className="px-3 py-1 bg-blue-600 text-white rounded-md">
          Generate
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2">
          <input checked={useLower} onChange={() => setUseLower((v) => !v)} type="checkbox" />
          lower
        </label>
        <label className="flex items-center gap-2">
          <input checked={useUpper} onChange={() => setUseUpper((v) => !v)} type="checkbox" />
          UPPER
        </label>
        <label className="flex items-center gap-2">
          <input checked={useNumbers} onChange={() => setUseNumbers((v) => !v)} type="checkbox" />
          numbers
        </label>
        <label className="flex items-center gap-2">
          <input checked={useSymbols} onChange={() => setUseSymbols((v) => !v)} type="checkbox" />
          symbols
        </label>
      </div>

      <label className="flex items-center gap-2">
        <input checked={excludeLookAlikes} onChange={() => setExcludeLookAlikes((v) => !v)} type="checkbox" />
        exclude look-alikes (l, 1, I, O, 0, o)
      </label>
    </div>
  );
}
