"use client";

import React, { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import PatternLock from "react-pattern-lock";

const API = "https://securevaultbackend.onrender.com/api/security";

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
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!isVerified && forceLock) return; // still locked
    if (config && (config.pinEnabled || config.passwordEnabled || config.patternEnabled)) {
      router.push("/vault");
    }
  }, [isVerified, forceLock, config, router]);
  
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

      if (!cfg || !(cfg.pinEnabled || cfg.passwordEnabled || cfg.patternEnabled)) {
        router.push("/auth/security-settings");
        return;
      }

      setConfig(cfg);

      const verifiedKey = `vaultVerified_${user.uid}`;
      const verifiedTime = localStorage.getItem(verifiedKey);

      const methods = ["pattern", "password", "pin"] as const;
      const lastEnabled = methods.find((method) => cfg[`${method}Enabled`]);

      if (verifiedTime) {
        setIsVerified(true);
        setForceLock(false);
        setShowModal(false);
        setStep("enter");
        setError("");
        setInputValue("");
        setPattern([]);
        setAuthMethod(lastEnabled || null);
      } else {
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
    if (user) fetchConfig();
    else if (!loadingUser) router.push("/");
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
        localStorage.setItem(`vaultVerified_${user!.uid}`, Date.now().toString());
      } else {
        setError("Invalid " + authMethod);
      }
    } catch (err: any) {
      console.error("Verification failed:", err);
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Verification failed. Please try again."
      );
    } finally {
      setVerifying(false);
    }
  };

  const modalTitle = authMethod
    ? { enter: `Enter your ${authMethod}`, forgot: `Forgot ${authMethod}?` }[step]
    : "Security Check";

  if (loadingUser || isLoadingConfig) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-3"></div>
        <p className="text-gray-500">Loading security configuration...</p>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      {!isVerified && forceLock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-700 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">{modalTitle}</h3>
            {authMethod === "pattern" && mounted ? (
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
            ) : (
              <input
                type={authMethod === "password" ? "password" : "text"}
                inputMode={authMethod === "pin" ? "numeric" : "text"}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full px-3 py-2 border rounded-md mb-4"
                placeholder={`Enter ${authMethod}`}
              />
            )}
            <button
              onClick={verify}
              disabled={verifying}
              className="w-full bg-blue-600 text-white py-2 rounded-md"
            >
              {verifying ? "Verifying..." : "Verify"}
            </button>
          </div>
        </div>
      )}
     
    </>
  );
};

export default SecurityGate;

