"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import Link from "next/link";
import "react-toastify/dist/ReactToastify.css";
import { QRCodeCanvas } from "qrcode.react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [randomCode, setRandomCode] = useState<string | null>(null);
  const [userInput, setUserInput] = useState("");
  const router = useRouter();

  const generateRandomCode = (length = 8) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

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
      localStorage.removeItem(`vaultVerified_${uid}`);

      // Generate random string and store in state
      const code = generateRandomCode(8);
      setRandomCode(code);

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = () => {
    if (userInput === randomCode) {
      const uid = auth.currentUser?.uid;
      if (uid) localStorage.setItem(`vaultVerified_${uid}`, "true");
      toast.success("Verification successful!");
      router.push("/vault");
    } else {
      toast.error("Incorrect code. Try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <ToastContainer aria-label="Notification" />
      <div className="max-w-md w-full space-y-8">
        {!randomCode ? (
          <form className="mt-8 space-y-6 bg-white p-8 rounded-lg shadow-md" onSubmit={handleSignIn}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your email"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your password"
                />
              </div>
            </div>
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </button>
            </div>
            <div className="text-sm text-center space-y-2">
              <Link href="/auth/signup" className="text-blue-600 hover:text-blue-500">Create account</Link>
              <Link href="/auth/forgot-password" className="text-blue-600 hover:text-blue-500">Forgot password?</Link>
            </div>
          </form>
        ) : (
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <h2 className="text-xl font-bold mb-4">Scan the QR and enter the code</h2>
            <QRCodeCanvas value={randomCode} size={200} />
            <input
              type="text"
              placeholder="Enter code here"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              className="mt-4 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
            />
            <button
              onClick={handleVerifyCode}
              className="mt-4 w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Verify
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
