"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import Link from "next/link";
import axios from "axios";
import "react-toastify/dist/ReactToastify.css";

const API_BASE =  "https://securevaultbackend.onrender.com";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [userInput, setUserInput] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const router = useRouter();

  // 1️⃣ Sign in and generate QR
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);

      if (!res.user.emailVerified) {
        toast.error("Please verify your email first!");
        setIsLoading(false);
        return;
      }

      const uid = res.user.uid;

      // Request QR & secret from backend
      const response = await axios.post(`${API_BASE}/api/generate-qr`, { uid, email });

      if (response.data.qrImage && response.data.secret) {
        setQrCodeUrl(response.data.qrImage);
        setSecretKey(response.data.secret);
        toast.success("QR code generated! Scan or copy secret key.");
      } else {
        toast.error("Failed to generate QR. Try again.");
      }
    } catch (error: any) {
      console.error("[frontend] generate-qr error:", error);
      toast.error(error.response?.data?.message || error.message || "Request failed");
    } finally {
      setIsLoading(false);
    }
  };

  // 2️⃣ Verify TOTP code
  const handleVerifyCode = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        toast.error("User not found. Please sign in again.");
        return;
      }

      const res = await axios.post(`${API_BASE}/api/verify-qr`, { uid, token: userInput });

      if (res.data.success) {
        toast.success("Verification successful!");
        router.push("/vault");
      } else {
        toast.error(res.data.message || "Invalid code. Try again.");
      }
    } catch (error: any) {
      console.error("[frontend] verify-qr error:", error);
      toast.error("Verification failed. Check console.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <ToastContainer aria-label="Notification" />
      <div className="max-w-md w-full space-y-8">
        {!qrCodeUrl ? (
          <form className="mt-8 space-y-6 bg-white p-8 rounded-lg shadow-md" onSubmit={handleSignIn}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
                <input
                  id="email" type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your email"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  id="password" type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your password"
                />
              </div>
            </div>
            <button type="submit" disabled={isLoading}
              className="w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50">
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
            <div className="text-sm text-center space-y-2 mt-2">
              <Link href="/auth/signup" className="text-blue-600 hover:text-blue-500">Create account</Link>
              <Link href="/auth/forgot-password" className="text-blue-600 hover:text-blue-500">Forgot password?</Link>
            </div>
          </form>
        ) : (
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <h2 className="text-xl font-bold mb-4">Scan this QR or copy secret key</h2>
            {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" className="mx-auto mb-4 w-48 h-48" />}
            {secretKey && (
              <p className="mb-2">
                <button
                  className="text-blue-600 underline"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? secretKey : "Show Secret Key"}
                </button>
              </p>
            )}
            <p className="text-sm text-gray-600 mb-2">Enter the 6-digit code from your Authenticator app</p>
            <input
              type="text" placeholder="Enter code" value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
            />
            <button onClick={handleVerifyCode}
              className="mt-4 w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700">
              Verify
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
