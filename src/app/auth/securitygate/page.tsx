"use client";

import React, { useEffect, useState, useCallback } from "react";
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
  const [step, setStep] = useState<"enter" | "forgot">("enter");
  const [selectedQuestion, setSelectedQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  const fetchConfig = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoadingConfig(true);
      const res = await axios.get(`${API}/${user.uid}`);
      const cfg = res.data.config;
      if (!cfg) {
        router.push("/auth/security-settings");
        return;
      }
      setConfig(cfg);

      const verifiedKey = `vaultVerified_${user.uid}`;
      if (localStorage.getItem(verifiedKey)) {
        setIsVerified(true);
        setForceLock(false);
      } else {
        const methods = ["pattern", "password", "pin"] as const;
        const lastEnabled = methods.find((m) => cfg[`${m}Enabled`]);
        setAuthMethod(lastEnabled || null);
        setForceLock(true);
      }
    } catch {
      setError("Could not load security configuration");
      setIsVerified(true);
      setForceLock(false);
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
  localStorage.setItem(`vaultVerified_${user!.uid}`, Date.now().toString());
  setIsVerified(true);
  setForceLock(false);
  setError("");
  router.push("/vault"); // ✅ redirect after successful verification
} else {
  setError("Invalid " + authMethod);
}
 catch (err: any) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Verification failed. Try again."
      );
    } finally {
      setVerifying(false);
    }
  };

  const verifySecurityAnswer = async () => {
  if (!selectedQuestion || !answer) {
    setError("Please select a question and provide an answer.");
    return;
  }

  setIsSubmittingAnswer(true);
  setError("");
  try {
    const res = await axios.post(`${API}/verify-security-answer`, {
      userId: user!.uid,
      question: selectedQuestion,
      answer,
    });

    if (res.data.success) {
      localStorage.setItem(`vaultVerified_${user!.uid}`, Date.now().toString());
      setIsVerified(true);
      setForceLock(false);
      setError("");
      setStep("enter");
      router.push("/vault"); // ✅ navigate to vault after success
    } else {
      setError("Incorrect answer.");
    }
  } catch (err: any) {
    setError(
      axios.isAxiosError(err) && err.response?.data?.message
        ? err.response.data.message
        : "Verification failed. Try again."
    );
  } finally {
    setIsSubmittingAnswer(false);
  }
};


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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md text-white">
            {step === "enter" && (
              <>
                <h3 className="text-lg font-medium mb-4">
                  Enter your {authMethod}
                </h3>
                {authMethod === "pattern" && mounted ? (
                  <PatternLock
                    width={250}
                    size={3}
                    path={pattern}
                    onChange={(pts) => setPattern(pts || [])}
                    onFinish={() => {
                      if (pattern.length < 3)
                        setError("Pattern must connect at least 3 dots.");
                      else setError("");
                    }}
                    disabled={verifying}
                  />
                ) : (
                  <input
                    type={authMethod === "password" ? "password" : "text"}
                    inputMode={authMethod === "pin" ? "numeric" : "text"}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md mb-4 text-black"
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

                {config?.securityQuestions?.length > 0 && (
                  <button
                    onClick={() => {
                      setStep("forgot");
                      setError("");
                      setAnswer("");
                      setSelectedQuestion("");
                    }}
                    className="w-full mt-3 text-sm underline text-gray-300 hover:text-white"
                  >
                    Forgot {authMethod}?
                  </button>
                )}

                {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}
              </>
            )}

            {step === "forgot" && (
              <>
                <h3 className="text-lg font-medium mb-4">
                  Answer a Security Question
                </h3>
                <select
                  value={selectedQuestion}
                  onChange={(e) => setSelectedQuestion(e.target.value)}
                  className="w-full mb-3 px-3 py-2 rounded-md text-black"
                >
                  <option value="">Select a question</option>
                  {config.securityQuestions.map((q: any, idx: number) => (
                    <option key={idx} value={q.question}>
                      {q.question}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md mb-4 text-black"
                  placeholder="Enter your answer"
                />

                <button
                  onClick={verifySecurityAnswer}
                  disabled={isSubmittingAnswer}
                  className="w-full bg-green-600 text-white py-2 rounded-md"
                >
                  {isSubmittingAnswer ? "Verifying..." : "Submit Answer"}
                </button>

                <button
                  onClick={() => setStep("enter")}
                  className="w-full mt-3 text-sm underline text-gray-300 hover:text-white"
                >
                  Back to {authMethod} login
                </button>

                {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default SecurityGate;

