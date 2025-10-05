// app/security-settings/page.tsx
"use client";

import Navbar from "../components/Navbar";
import SecuritySettings from "../components/SecuritySettings";

export default function SecuritySettingsPage() {
  return (
    <>
      <Navbar />
      <div className="container mx-auto p-4 pt-0"> {/* pt-0 to avoid double padding with navbar */}
        <SecuritySettings />
      </div>
    </>
  );
}