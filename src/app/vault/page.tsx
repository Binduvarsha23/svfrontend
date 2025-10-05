// app/vault/page.tsx (if this is causing issues, here's a stabilized version)
"use client";

import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import Navbar from "../auth/components/Navbar";
import VaultManager from "@/components/VaultManager"; // Adjust path as needed
import { useEffect, useState } from "react";

export default function VaultPage() {
  const [user, loading] = useAuthState(auth);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setUserId(user.uid);
    } else {
      setUserId(null);
    }
  }, [user]);

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading your vault...</div>;
  if (!userId) return <div className="flex items-center justify-center min-h-screen">Please log in to access your vault.</div>;

   return (
    <>
      <Navbar />
      <VaultManager userId={userId} />
    </>
  );
}