// app/auth/securitygate/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import PatternLock from "react-pattern-lock";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import Link from "next/link";
import Vault from "@/app/vault/page"; 

const API = "https://backend-pbmi.onrender.com/api/security-config";

interface SecurityGateProps {
  children?: React.ReactNode;
}

const SecurityGate: React.FC<SecurityGateProps> = ({ children }) => {
  const [user, loadingUser] = useAuthState(auth);
  const [isVerified, setIsVerified] = useState(false);
  const [forceLock, setForceLock] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [authMethod, setAuthMethod] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [pattern, setPattern] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<"enter" | "forgot">("enter");
  const [selectedQuestion, setSelectedQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const router = useRouter();

  const fetchConfig = useCallback(async () => {
    if (!user) {
      setIsVerified(true);
      setForceLock(false);
      setShowModal(false);
      setError("User not authenticated. Please log in.");
      setIsLoadingConfig(false);
      return;
    }

    try {
      setIsLoadingConfig(true);

      const res = await axios.get(`${API}/${user.uid}`);
      const cfg = res.data.config;

      if (
        res.data.setupRequired ||
        !(cfg.pinEnabled || cfg.passwordEnabled || cfg.patternEnabled)
      ) {
        setIsLoadingConfig(false);
        router.push("/auth/security-settings"); // Redirect to setup
        return;
      }

      setConfig(cfg);

      // Check for persisted verification (set after successful post-login verification)
      const verifiedKey = `vaultVerified_${user.uid}`;
      const verifiedTime = localStorage.getItem(verifiedKey);
      if (verifiedTime) {
        setIsVerified(true);
        setForceLock(false);
        setShowModal(false);
        setStep("enter");
        setError("");
        setInputValue("");
        setPattern([]);
        // Set authMethod for potential future use, but skip prompt
        const methods = ["pattern", "password", "pin"] as const;
        const lastEnabled = methods.find((method) => cfg[`${method}Enabled`]);
        setAuthMethod(lastEnabled || null);
      } else {
        // Prompt for verification (this happens only after fresh login)
        const methods = ["pattern", "password", "pin"] as const;
        const lastEnabled = methods.find((method) => cfg[`${method}Enabled`]);
        setAuthMethod(lastEnabled || null);
        setIsVerified(false);
        setForceLock(true);
        setShowModal(true);
        setStep("enter");
        setError("");
        setInputValue("");
        setPattern([]);
      }
    } catch (err) {
      console.error("Error fetching config:", err);
      setError("Failed to fetch security settings. Access granted for now.");
      setIsVerified(true);
      setForceLock(false);
      setShowModal(false);
      setAuthMethod(null);
    } finally {
      setIsLoadingConfig(false);
    }
  }, [user, router]);

  useEffect(() => {
    if (user) {
      fetchConfig();
    } else if (!loadingUser) {
      router.push("/");
    }
  }, [user, loadingUser, fetchConfig, router]);

  const verify = async () => {
    setVerifying(true);
    setError("");

    try {
      let valueToVerify = inputValue;
      if (authMethod === "pattern") {
        if (pattern.length < 3) {
          setError("Pattern must connect at least 3 dots.");
          setVerifying(false);
          return;
        }
        valueToVerify = JSON.stringify(pattern);
      }

      const res = await axios.post(`${API}/verify`, {
        userId: user!.uid,
        value: valueToVerify,
        method: authMethod,
      });
      if (res.data.success) {
        setIsVerified(true);
        setForceLock(false);
        setShowModal(false);
        setInputValue("");
        setPattern([]);
        setError("");
        // Persist verification until logout
        const verifiedKey = `vaultVerified_${user!.uid}`;
        localStorage.setItem(verifiedKey, Date.now().toString());
      } else {
        setError("Invalid " + authMethod);
      }
    } catch (err: any) {
      console.error("Verification failed:", err);
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("Verification failed. Please try again.");
      }
    } finally {
      setVerifying(false);
    }
  };

  const verifyAnswer = async () => {
    setIsSubmittingAnswer(true);
    setError("");
    try {
      const res = await axios.post(`${API}/verify-security-answer`, {
        userId: user!.uid,
        question: selectedQuestion,
        answer: answer.trim(),
      });
      if (res.data.success) {
        setIsVerified(true);
        setForceLock(false);
        setShowModal(false);
        setStep("enter");
        setAnswer("");
        setSelectedQuestion("");
        setError("");
        // Persist verification until logout
        const verifiedKey = `vaultVerified_${user!.uid}`;
        localStorage.setItem(verifiedKey, Date.now().toString());
      } else {
        setError(res.data.message || "Incorrect answer.");
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      setError(axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : "Verification error.");
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  // Custom Spinner Component
  const Spinner = () => (
    <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
  );

  // Custom Alert Component
  const AlertComponent = ({ variant = "danger", message }: { variant?: "danger" | "warning"; message: string }) => (
    <div
      className={`px-4 py-3 rounded-md mb-4 ${
        variant === "danger"
          ? "bg-red-50 border border-red-200 text-red-700"
          : "bg-yellow-50 border border-yellow-200 text-yellow-700"
      }`}
    >
      {message}
    </div>
  );

  // Custom Modal Component with Tailwind
  const CustomModal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          </div>
          <div className="px-6 py-4">{children}</div>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
            {/* Close button if needed */}
          </div>
        </div>
      </div>
    );
  };

  if (loadingUser || isLoadingConfig) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-3"></div>
        <p className="text-gray-500">Loading security configuration...</p>
      </div>
    );
  }

  const modalTitle = authMethod
    ? ({
        enter: `Enter your ${authMethod}`,
        forgot: `Forgot ${authMethod}? Use Security Question`,
      }[step] || `Verify with ${authMethod}`)
    : "Security Check";

  return (
    <>
      <Navbar />
      {!isVerified && forceLock ? (
        <CustomModal isOpen={showModal} onClose={() => {}} title={modalTitle}>
          {error && <AlertComponent variant="danger" message={error} />}

          {step === "enter" && authMethod && (
            <div className="space-y-4">
              {authMethod === "pattern" ? (
                <div className="text-center p-3 rounded-lg bg-gray-800 text-white">
                  <p className="font-semibold mb-3">Draw Your Pattern</p>
                  <PatternLock
                    width={250}
                    size={3}
                    path={pattern}
                    onChange={(pts) => setPattern(pts || [])}
                    onFinish={() => {
                      if (pattern.length < 3) {
                        setError("Pattern must connect at least 3 dots.");
                      } else {
                        setError("");
                      }
                    }}
                    disabled={verifying}
                  />
                </div>
              ) : (
                <input
                  type={authMethod === "password" ? "password" : "text"}
                  inputMode={authMethod === "pin" ? "numeric" : "text"}
                  value={inputValue}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
                  placeholder={`Enter ${authMethod}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  autoFocus
                  disabled={verifying}
                />
              )}
              <div className="flex justify-between pt-4">
                <button
                  onClick={verify}
                  disabled={verifying}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {verifying ? (
                    <>
                      <Spinner />
                      <span className="ml-2">Verifying...</span>
                    </>
                  ) : (
                    "Verify"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("forgot")}
                  disabled={verifying}
                  className="text-blue-600 hover:text-blue-500 text-sm font-medium transition-colors duration-200 disabled:opacity-50"
                >
                  Forgot?
                </button>
              </div>
            </div>
          )}

          {step === "forgot" && (
            <div className="space-y-4">
              {config?.securityQuestions?.length > 0 ? (
                <>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                    value={selectedQuestion}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedQuestion(e.target.value)}
                    disabled={isSubmittingAnswer}
                  >
                    <option value="">Choose Security Question</option>
                    {config.securityQuestions.map((q: any, i: number) => (
                      <option key={i} value={q.question}>
                        {q.question}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                    placeholder="Answer"
                    value={answer}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAnswer(e.target.value)}
                    disabled={isSubmittingAnswer}
                  />
                  <button
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                    onClick={verifyAnswer}
                    disabled={isSubmittingAnswer}
                  >
                    {isSubmittingAnswer ? (
                      <>
                        <Spinner />
                        <span className="ml-2">Submitting...</span>
                      </>
                    ) : (
                      "Submit Answer"
                    )}
                  </button>
                </>
              ) : (
                <AlertComponent variant="warning" message="No security questions set up. Please set them in Security Settings." />
              )}
              <button
                type="button"
                onClick={() => setStep("enter")}
                disabled={isSubmittingAnswer}
                className="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                I remember my {authMethod}
              </button>
            </div>
          )}
        </CustomModal>
      ) : (
        <div className="container mx-auto p-4 pt-0">
          {/* If no methods enabled */}
          {config && !(config.pinEnabled || config.passwordEnabled || config.patternEnabled) ? (
            <>
              <h1 className="text-2xl font-bold mb-4 text-gray-900">Welcome to Your Vault</h1>
              <p className="text-gray-600 mb-4">
                No 2FA method enabled yet. Set up in{" "}
                <Link href="/auth/security-settings" className="text-blue-600 hover:text-blue-500 font-medium">
                  Security Settings
                </Link>
                .
              </p>
            </>
          ) : (
            <>
                        <Vault />

            </>
          )}
        </div>
      )}
    </>
  );
};


export default SecurityGate;
