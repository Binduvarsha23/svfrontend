"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import { format } from "date-fns";
import PatternLock from "react-pattern-lock";
import { useTheme } from "@/content/ThemeContext";

const API = "https://securevaultbackend.onrender.com/api/security";

const FIXED_SECURITY_QUESTIONS = [
  "What was the name of your first school?",
  "What is your favorite food?",
  "In what city were you born?",
  "What was the name of your favorite teacher?",
  "What is the name of your best friend?",
  "What was your childhood nickname?",
  "What is your mother's maiden name?",
  "What was the make of your first car?",
  "What is your favorite book?",
  "What is your favorite movie?",
];

interface SecurityQuestion {
  question: string;
  answer: string;
}

interface BackendSecurityQuestion {
  question: string;
  answerHash: string;
}

interface Config {
  pinEnabled: boolean;
  passwordEnabled: boolean;
  patternEnabled: boolean;
  securityQuestions?: BackendSecurityQuestion[];
  securityQuestionsLastUpdatedAt?: string;
  pinHash?: string;
  passwordHash?: string;
  patternHash?: string;
}

const SecuritySettings = () => {
  const [user, loadingAuth] = useAuthState(auth); // Add loadingAuth
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState("");
  const [pattern, setPattern] = useState<number[]>([]);
  const [confirmPattern, setConfirmPattern] = useState<number[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestion[]>([
    { question: "", answer: "" },
    { question: "", answer: "" },
    { question: "", answer: "" },
  ]);
  const [showSecurityQuestionsForm, setShowSecurityQuestionsForm] = useState(false);
  const [canChangeSecurityQuestions, setCanChangeSecurityQuestions] = useState(true);
  const [nextChangeDate, setNextChangeDate] = useState<Date | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [confirmValue, setConfirmValue] = useState("");
    const { theme } = useTheme();

  const [activeMethod, setActiveMethod] = useState<string | null>(null);

  useEffect(() => {
    if (loadingAuth) {
      // Wait for Firebase auth to resolve
      setLoading(true);
      return;
    }

    if (!user) {
      setLoading(false);
      setError("User not authenticated. Please log in.");
      return;
    }

    fetchConfig();
  }, [user, loadingAuth]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/${user!.uid}`);
      const cfg: Config = res.data.config || {};

      setConfig(cfg);

      if (cfg.securityQuestions?.length) {
        setSecurityQuestions(
          cfg.securityQuestions.map((q: BackendSecurityQuestion) => ({
            question: q.question,
            answer: "",
          }))
        );
      } else {
        setSecurityQuestions([
          { question: "", answer: "" },
          { question: "", answer: "" },
          { question: "", answer: "" },
        ]);
      }

      if (cfg.securityQuestionsLastUpdatedAt) {
        const lastUpdated = new Date(cfg.securityQuestionsLastUpdatedAt);
        const sixMonthsLater = new Date(lastUpdated.setMonth(lastUpdated.getMonth() + 6));
        const now = new Date();

        if (now < sixMonthsLater) {
          setCanChangeSecurityQuestions(false);
          setNextChangeDate(sixMonthsLater);
        } else {
          setCanChangeSecurityQuestions(true);
          setNextChangeDate(null);
        }
      } else {
        setCanChangeSecurityQuestions(true);
        setNextChangeDate(null);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error fetching security config:", err);
      setError("Failed to fetch security settings.");
      setLoading(false);
    }
  };

  const handleToggle = async (method: string) => {
    if (!config || !user) return;

    const isEnabled = config[`${method}Enabled` as keyof Config];

    if (isEnabled) {
      try {
        setIsSaving(true);
        const updated = { userId: user!.uid, [`${method}Enabled`]: false };

        const res = await axios.put(`${API}/${user!.uid}`, updated);
        setConfig(res.data);
        setSuccessMessage(`${method.charAt(0).toUpperCase() + method.slice(1)} has been disabled.`);
        setError("");
      } catch (err) {
        console.error(`Failed to disable ${method}:`, err);
        setError(`Failed to disable ${method}.`);
        setSuccessMessage("");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setMode(method);
    setActiveMethod(method);
    setValue("");
    setConfirmValue("");
    setPattern([]);
    setConfirmPattern([]);
    setError("");
    setSuccessMessage("");
  };

  const handleSubmit = async () => {
    const method = activeMethod;
    if (!method || !user || !user.uid) {
      setError("User not authenticated. Cannot save settings.");
      return;
    }

    setIsSaving(true);

    try {
      if (method === "pattern") {
        if (pattern.length < 3 || confirmPattern.length < 3) {
          setError("Pattern must connect at least 3 dots.");
          setIsSaving(false);
          return;
        }

        if (JSON.stringify(pattern) !== JSON.stringify(confirmPattern)) {
          setError("Patterns do not match.");
          setIsSaving(false);
          return;
        }

        const bcryptModule = await import("bcryptjs");
        const bcrypt = bcryptModule.default || bcryptModule;
        const hash = await bcrypt.hash(JSON.stringify(pattern), 10);
        const updated = {
          userId: user.uid,
          patternHash: hash,
          patternEnabled: true,
          pinEnabled: false,
          passwordEnabled: false,
        };

        const res = await axios.put(`${API}/${user.uid}`, updated);
        setConfig(res.data);
        setPattern([]);
        setConfirmPattern([]);
        setMode(null);
        setSuccessMessage("Pattern has been set successfully.");
        setError("");
      } else {
        const trimmedValue = value.trim();
        const trimmedConfirm = confirmValue.trim();

        if (!trimmedValue || !trimmedConfirm) {
          setError("Both fields are required.");
          setIsSaving(false);
          return;
        }

        if (trimmedValue !== trimmedConfirm) {
          setError("Values do not match.");
          setIsSaving(false);
          return;
        }

        if (method === "pin" && !/^\d{6}$/.test(trimmedValue)) {
          setError("PIN must be exactly 6 digits.");
          setIsSaving(false);
          return;
        }

        if (method === "password" && !/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{6,}$/.test(trimmedValue)) {
          setError("Password must be at least 6 characters, include a capital letter, a digit, and a special character.");
          setIsSaving(false);
          return;
        }

        const bcryptModule = await import("bcryptjs");
        const bcrypt = bcryptModule.default || bcryptModule;
        const hash = await bcrypt.hash(trimmedValue, 10);
        const updated: any = { userId: user.uid };
        updated[`${method}Hash`] = hash;
        updated[`${method}Enabled`] = true;

        const otherMethods = ["pin", "password", "pattern"].filter(m => m !== method);
        otherMethods.forEach(m => updated[`${m}Enabled`] = false);

        const res = await axios.put(`${API}/${user.uid}`, updated);
        setConfig(res.data);
        setMode(null);
        setValue("");
        setConfirmValue("");
        setSuccessMessage(`${method.charAt(0).toUpperCase() + method.slice(1)} has been set successfully.`);
        setError("");
      }
    } catch (err) {
      console.error("Failed to set authentication method:", err);
      setError("Failed to set authentication method.");
      setSuccessMessage("");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSecurityQuestionChange = (index: number, field: keyof SecurityQuestion, newValue: string) => {
    const newQuestions = [...securityQuestions];
    if (field === "question") {
      const selected = newQuestions.map((q) => q.question);
      if (selected.includes(newValue) && selected.indexOf(newValue) !== index) {
        setError("Each question must be unique.");
        return;
      }
    }
    newQuestions[index][field] = newValue;
    setSecurityQuestions(newQuestions);
    setError("");
  };

  const handleSaveSecurityQuestions = async () => {
    if (!user || !user.uid) {
      setError("User not authenticated. Cannot save security questions.");
      return;
    }

    setIsSaving(true);

    try {
      const hasEmptyFields = securityQuestions.some(q => !q.question || !q.answer.trim());
      if (hasEmptyFields) {
        setError("Please complete all questions and answers.");
        setIsSaving(false);
        return;
      }

      const unique = new Set(securityQuestions.map(q => q.question));
      if (unique.size !== 3) {
        setError("Please choose 3 different questions.");
        setIsSaving(false);
        return;
      }

      const bcryptModule = await import("bcryptjs");
      const bcrypt = bcryptModule.default || bcryptModule;
      const questionsWithHashedAnswers = await Promise.all(
        securityQuestions.map(async (q: SecurityQuestion) => ({
          question: q.question,
          answerHash: await bcrypt.hash(q.answer.trim(), 10),
        }))
      );

      await axios.put(`${API}/security-questions/${user.uid}`, {
        questions: questionsWithHashedAnswers,
      });
      setSuccessMessage("Security questions updated successfully.");
      setShowSecurityQuestionsForm(false);
      setError("");
      fetchConfig();
    } catch (err) {
      console.error("Failed to save security questions:", err);
      setError("Failed to save security questions.");
      setSuccessMessage("");
    } finally {
      setIsSaving(false);
    }
  };

  const Spinner = () => (
    <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 dark:border-blue-400"></div>
  );

  if (loading || loadingAuth) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
        <p className="mt-3 text-gray-500 dark:text-gray-400">Loading security settings...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-gray-50 dark:bg-gray-900">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded">
          User not authenticated. Please log in.
        </div>
      </div>
    );
  }

  return (
        <div
      className={`min-h-screen p-6 transition-colors duration-500 ${
        theme === "dark"
          ? "bg-gray-400"
          : "bg-blue-100"
      }`}
    >
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800 dark:text-gray-100">Security Settings</h1>
        
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {successMessage && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded mb-4">
            {successMessage}
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Authentication Methods</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {["pin", "password", "pattern"].map((method) => (
              <div key={method} className="space-y-2">
                <label className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
                  <span>Enable {method.charAt(0).toUpperCase() + method.slice(1)}</span>
                  <input
  type="checkbox"
  checked={Boolean(config?.[`${method}Enabled` as keyof Config])}
  onChange={() => handleToggle(method)}
  disabled={isSaving}
  className={`relative inline-block w-10 h-6 rounded-full border-2 transition-all duration-300 ease-in-out
    ${theme === "dark"
      ? "border-gray-500 bg-gray-700 checked:bg-gray-500 focus:ring-gray-400"
      : "border-gray-300 bg-gray-200 checked:bg-blue-600 focus:ring-blue-500"
    }
    focus:outline-none focus:ring-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
  `}
/>

                  <span className="sr-only">{method} toggle</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {mode === "pin" && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Set a 6-digit PIN</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Enter 6-digit PIN</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter 6-digit PIN"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-gray-100"
                  value={value}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
                  maxLength={6}
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm 6-digit PIN</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Confirm 6-digit PIN"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-gray-100"
                  value={confirmValue}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmValue(e.target.value)}
                  maxLength={6}
                  disabled={isSaving}
                />
              </div>
              <button
      className={`w-full font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300 ${
        theme === "dark"
          ? "bg-gray-700 hover:bg-gray-600 text-gray-100 focus:ring-gray-400"
          : "bg-blue-500 hover:bg-blue-700 text-white focus:ring-blue-400"
      }`}
      onClick={handleSubmit}
      disabled={isSaving}
    >
      {isSaving && activeMethod === "pin" ? (
        <>
          <Spinner />
          <span className="ml-2">Saving...</span>
        </>
      ) : (
        "Save PIN"
      )}
    </button>
            </div>
          </div>
        )}

        {mode === "password" && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Set a Strong Password</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Enter Password</label>
                <input
                  type="password"
                  placeholder="Enter Password"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-gray-100"
                  value={value}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm Password</label>
                <input
                  type="password"
                  placeholder="Confirm Password"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-gray-100"
                  value={confirmValue}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmValue(e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <button
                className="w-full bg-blue-500 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSubmit}
                disabled={isSaving}
              >
                {isSaving && activeMethod === "password" ? (
                  <>
                    <Spinner />
                    <span className="ml-2">Saving...</span>
                  </>
                ) : (
                  "Save Password"
                )}
              </button>
            </div>
          </div>
        )}

        {mode === "pattern" && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100 text-center">Draw and Confirm Your Pattern</h3>
            <div className="space-y-6 text-center">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Draw Pattern</label>
                <div className="bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-4 inline-block">
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
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirm Pattern</label>
                <div className="bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-4 inline-block">
                  <PatternLock
                    width={250}
                    size={3}
                    path={confirmPattern}
                    onChange={(pts) => setConfirmPattern(pts || [])}
                    onFinish={() => {
                      if (confirmPattern.length < 3) {
                        setError("Confirm pattern must connect at least 3 dots.");
                      } else {
                        setError("");
                      }
                    }}
                  />
                </div>
              </div>
              <button
                className="w-full bg-blue-500 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSubmit}
                disabled={isSaving}
              >
                {isSaving && activeMethod === "pattern" ? (
                  <>
                    <Spinner />
                    <span className="ml-2">Saving...</span>
                  </>
                ) : (
                  "Save Pattern"
                )}
              </button>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Security Questions</h2>
            <button
              className="bg-gray-500 hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => {
                setShowSecurityQuestionsForm(!showSecurityQuestionsForm);
                setError("");
                setSuccessMessage("");
              }}
              disabled={!canChangeSecurityQuestions || isSaving}
            >
              {showSecurityQuestionsForm ? "Hide Form" : "Set/Update Questions"}
            </button>
          </div>

          {config?.securityQuestionsLastUpdatedAt && !canChangeSecurityQuestions && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 px-4 py-3 rounded mb-4">
              You can update your security questions again on {nextChangeDate ? format(nextChangeDate, "PPP") : "N/A"}.
            </div>
          )}

          {showSecurityQuestionsForm && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
              <div className="space-y-6">
                {securityQuestions.map((q, idx) => (
                  <div key={idx} className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Question {idx + 1}</label>
                    <div className="space-y-2">
                      <select
                        value={q.question}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleSecurityQuestionChange(idx, "question", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-gray-100"
                        disabled={isSaving}
                      >
                        <option value="">Choose a question</option>
                        {FIXED_SECURITY_QUESTIONS.map((fixedQ, i) => (
                          <option
                            key={i}
                            value={fixedQ}
                            disabled={securityQuestions.some((sq, j) => j !== idx && sq.question === fixedQ) || isSaving}
                          >
                            {fixedQ}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Answer</label>
                      <input
                        type="text"
                        placeholder="Enter your answer"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-gray-100"
                        value={q.answer}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSecurityQuestionChange(idx, "answer", e.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                ))}
                <button
                  className="w-full bg-green-500 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-800 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleSaveSecurityQuestions}
                  disabled={isSaving}
                >
                  {isSaving && showSecurityQuestionsForm ? (
                    <>
                      <Spinner />
                      <span className="ml-2">Saving...</span>
                    </>
                  ) : (
                    "Save Security Questions"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecuritySettings;
