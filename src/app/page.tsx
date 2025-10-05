// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Link from "next/link";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully!");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <ToastContainer aria-label="Notification" />
      {user ? (
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-gray-900">Welcome, {user.email}</h1>
          <p className="text-gray-600">Your secure vault is ready.</p>
          <div className="flex gap-4 justify-center mt-4">
            <Link
              href="/auth/securitygate"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              Go to Vault
            </Link>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              Logout
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to Secure Vault</h1>
          <p className="text-gray-600">Sign in or create an account to get started.</p>
          <div className="flex gap-4 justify-center mt-4">
            <Link
              href="/auth/signin"
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              Sign Up
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}