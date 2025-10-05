"use client";

import React, { useState, useEffect } from "react";
import { encryptData, decryptData, safeParseJson } from "@/lib/crypto";
interface EncryptedVaultItem {
  _id: string;
  userId: string;
  title: string;
  username: string; // JSON or plaintext
  password: string; // JSON or plaintext
  url?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface DecryptedVaultItem {
  _id: string;
  userId: string;
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  encryptedUsername: string;
  encryptedPassword: string;
  isLegacy?: boolean;
}

interface VaultManagerProps {
  userId: string;
}

type ToastType = "success" | "error" | "info" | "";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://securevaultbackend.onrender.com/api";

const VaultManager: React.FC<VaultManagerProps> = ({ userId }) => {
  const [encryptedVaults, setEncryptedVaults] = useState<EncryptedVaultItem[]>([]);
  const [decryptedVaults, setDecryptedVaults] = useState<DecryptedVaultItem[]>([]);
  const [filteredVaults, setFilteredVaults] = useState<DecryptedVaultItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState<boolean>(false);
  const [currentEditId, setCurrentEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    username: "",
    password: "",
    url: "",
    notes: "",
  });
  const [toast, setToast] = useState({ message: "", type: "" as ToastType });
  const [generatorOptions, setGeneratorOptions] = useState({
    length: 16,
    includeNumbers: true,
    includeSymbols: true,
    excludeAmbiguous: true,
  });
  const [generatedPassword, setGeneratedPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Add to existing useState group
  const [visiblePasswordIds, setVisiblePasswordIds] = useState<Record<string, boolean>>({});
  const [showFormPassword, setShowFormPassword] = useState<boolean>(false);

  const toggleVaultPassword = (id: string) => {
    setVisiblePasswordIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleFormPassword = () => setShowFormPassword((s) => !s);

  // Fetch and decrypt vaults on mount
  useEffect(() => {
    if (userId) {
      fetchAndDecryptVaults();
    }
  }, [userId]);

  // Filter on search change
  useEffect(() => {
    const filtered = decryptedVaults.filter(
      (vault) =>
        vault.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vault.username.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredVaults(filtered);
  }, [searchTerm, decryptedVaults]);

  const fetchAndDecryptVaults = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/vault/${userId}`);
      if (response.ok) {
        const encryptedData = await response.json() as EncryptedVaultItem[];
        setEncryptedVaults(encryptedData);

        // Decrypt with smart parsing
        const decryptedData = await Promise.all(
          encryptedData.map(async (vault) => {
            let decryptedUsername = "[No Username]";
            let decryptedPassword = "[No Password]";
            let isLegacy = false;

            // Parse username with safeParseJson
            const usernameParsed = safeParseJson(vault.username); // Fixed: Now imported
            if (usernameParsed && typeof usernameParsed === "object" && usernameParsed.cipherText && usernameParsed.salt && usernameParsed.iv) {
              try {
                decryptedUsername = await decryptData(usernameParsed, userId);
              } catch {
                decryptedUsername = "[Encrypted - Edit to decrypt]";
                isLegacy = true;
              }
            } else if (vault.username && vault.username.length < 50 && !vault.username.startsWith("{") && !vault.username.startsWith("\"{")) {
              // Likely plaintext (short, no JSON indicators)
              decryptedUsername = vault.username;
              isLegacy = true;
              console.warn(`Plaintext legacy username for vault ${vault._id}`);
            } else {
              decryptedUsername = vault.username || decryptedUsername;
              isLegacy = true;
            }

            // Parse password with safeParseJson
            const passwordParsed = safeParseJson(vault.password); // Fixed: Now imported
            if (passwordParsed && typeof passwordParsed === "object" && passwordParsed.cipherText && passwordParsed.salt && passwordParsed.iv) {
              try {
                decryptedPassword = await decryptData(passwordParsed, userId);
              } catch {
                decryptedPassword = "[Encrypted - Edit to decrypt]";
                isLegacy = true;
              }
            } else if (vault.password && vault.password.length < 50 && !vault.password.startsWith("{") && !vault.password.startsWith("\"{")) {
              // Likely plaintext
              decryptedPassword = vault.password;
              isLegacy = true;
              console.warn(`Plaintext legacy password for vault ${vault._id}`);
            } else {
              decryptedPassword = vault.password || decryptedPassword;
              isLegacy = true;
            }

            return {
              ...vault,
              username: decryptedUsername,
              password: decryptedPassword,
              encryptedUsername: vault.username,
              encryptedPassword: vault.password,
              isLegacy,
            } as DecryptedVaultItem;
          })
        );
        setDecryptedVaults(decryptedData);
      } else {
        setToast({ message: "Failed to fetch vaults", type: "error" });
      }
    } catch (error) {
      console.error("Error fetching vaults:", error);
      setToast({ message: "Network error", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // ... (encryptField, handleSubmit, handleEdit, handleDelete, copyToClipboard, resetForm, generatePassword, useGeneratedPassword, useEffect for toast - unchanged from previous)

  const encryptField = async (text: string): Promise<string> => {
    const encrypted = await encryptData(text, userId);
    return JSON.stringify(encrypted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const encryptedUsername = await encryptField(formData.username);
      const encryptedPassword = await encryptField(formData.password);

      const payload = {
        ...formData,
        userId,
        username: encryptedUsername,
        password: encryptedPassword,
      };

      const url = currentEditId ? `${API_BASE}/vault/${currentEditId}` : `${API_BASE}/vault`;
      const method = currentEditId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await fetchAndDecryptVaults();
        resetForm();
        setIsAddModalOpen(false);
        setIsEditModalOpen(false);
        setToast({ message: "Entry saved & decrypted for viewing!", type: "success" });
      } else {
        const errorText = await response.text();
        setToast({ message: `Failed to save: ${errorText}`, type: "error" });
      }
    } catch (error) {
      console.error("Error saving vault:", error);
      setToast({ message: "Encryption error", type: "error" });
    }
  };

  const handleEdit = (vault: DecryptedVaultItem) => {
    setFormData({
      title: vault.title,
      username: vault.username === "[Encrypted - Edit to decrypt]" ? "" : vault.username,
      password: vault.password === "[Encrypted - Edit to decrypt]" ? "" : vault.password,
      url: vault.url || "",
      notes: vault.notes || "",
    });
    setCurrentEditId(vault._id);
    setIsEditModalOpen(true);
    if (vault.isLegacy) {
      setToast({ message: "Legacy loaded. Edit & save to decrypt with your account key.", type: "info" });
    }
  };

  // ... (rest unchanged: handleDelete, copyToClipboard, resetForm, generatePassword, useGeneratedPassword, toast useEffect)

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    try {
      const response = await fetch(`${API_BASE}/vault/${id}`, { method: "DELETE" });
      if (response.ok) {
        await fetchAndDecryptVaults();
        setToast({ message: "Deleted", type: "success" });
      } else {
        setToast({ message: "Delete failed", type: "error" });
      }
    } catch (error) {
      setToast({ message: "Server error", type: "error" });
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      if (navigator.clipboard && document.hasFocus()) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setToast({ message: `${field} copied! Clears in 15s`, type: "info" });
      setTimeout(async () => navigator.clipboard?.writeText(""), 15000);
    } catch {
      setToast({ message: "Copy failed", type: "error" });
    }
  };

  const resetForm = () => {
    setFormData({ title: "", username: "", password: "", url: "", notes: "" });
    setCurrentEditId(null);
  };

  const generatePassword = () => {
    const { length, includeNumbers, includeSymbols, excludeAmbiguous } = generatorOptions;
    let charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (includeNumbers) charset += "1234567890";
    if (includeSymbols) charset += "!@#$%^&*()_+-=[]{}|;:,.<>?";
    if (excludeAmbiguous) charset = charset.replace(/[0OIl]/g, "");

    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setGeneratedPassword(password);
  };

  const useGeneratedPassword = () => {
    setFormData((prev) => ({ ...prev, password: generatedPassword }));
    setIsGeneratorOpen(false);
  };

  useEffect(() => {
    if (toast.message) {
      const timer = setTimeout(() => setToast({ message: "", type: "" }), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p>Loading & decrypting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Password Vault ({decryptedVaults.length} entries)</h1>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by title or username..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        onClick={() => {
          resetForm();
          setIsAddModalOpen(true);
        }}
        className="mb-6 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
      >
        Add New Entry
      </button>

      <div className="grid gap-4">
        {filteredVaults.length > 0 ? (
          filteredVaults.map((vault) => (
            <div key={vault._id} className="bg-white p-4 rounded-lg shadow-md border">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{vault.title}</h3>
                  <p className="text-gray-600">
                    Username: {vault.username} {vault.isLegacy && <span className="text-yellow-600 text-sm">(Edit to decrypt)</span>}
                  </p>
                  {vault.password !== "[No Password]" && (
                    <p className="text-gray-600 text-sm flex items-center gap-2">
                      <span>
                        Password:&nbsp;
                        {visiblePasswordIds[vault._id]
                          ? vault.password
                          : Array.from({ length: Math.min(12, vault.password.length || 8) }).map(() => "•").join("")}
                      </span>

                      <button
                        onClick={() => toggleVaultPassword(vault._id)}
                        title={visiblePasswordIds[vault._id] ? "Hide password" : "Show password"}
                        className="text-sm p-1 rounded hover:bg-gray-100"
                        aria-label={visiblePasswordIds[vault._id] ? "Hide password" : "Show password"}
                      >
                        {visiblePasswordIds[vault._id] ? "🙈" : "👁️"}
                      </button>

                      {vault.isLegacy && <span className="text-yellow-600 text-xs">(Edit to decrypt)</span>}
                    </p>
                  )}

                  {vault.url && (
                    <p className="text-sm text-blue-500 mt-1">
                      <a href={vault.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {vault.url}
                      </a>
                    </p>
                  )}
                  {vault.notes && <p className="text-sm text-gray-500 mt-2">{vault.notes}</p>}
                </div>
                <div className="flex gap-2 ml-4 flex-shrink-0">
                  <button
                    onClick={() => copyToClipboard(vault.username, "Username")}
                    title="Copy Username"
                    className="text-green-500 hover:text-green-700 p-1 rounded"
                  >
                    📋
                  </button>
                  <button
                    onClick={() => copyToClipboard(vault.password, "Password")}
                    title="Copy Password"
                    className="text-green-500 hover:text-green-700 p-1 rounded"
                  >
                    🔑
                  </button>
                  <button onClick={() => handleEdit(vault)} className="text-blue-500 hover:text-blue-700 px-2 py-1 rounded text-sm">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(vault._id)} className="text-red-500 hover:text-red-700 px-2 py-1 rounded text-sm">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 py-8 col-span-full">
            {searchTerm ? "No entries found." : "No entries yet. Add one!"}
          </p>
        )}
      </div>

      {toast.message && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${toast.type === "success" ? "bg-green-500" : toast.type === "error" ? "bg-red-500" : "bg-blue-500"} text-white`}>
          {toast.message}
        </div>
      )}

      {/* Add/Edit Modal - Unchanged */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}>
          <div className="bg-white p-6 rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-4">{currentEditId ? "Edit Entry" : "Add Entry"}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Title *"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Username *"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <div className="relative">
                <input
                  type={showFormPassword ? "text" : "password"}
                  placeholder="Password *"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-28"
                  required
                />

                {/* Eye toggle */}
                <button
                  type="button"
                  onClick={toggleFormPassword}
                  className="absolute right-20 top-1/2 transform -translate-y-1/2 text-sm text-gray-600 hover:text-gray-800 px-2"
                  title={showFormPassword ? "Hide password" : "Show password"}
                >
                  {showFormPassword ? "🙈" : "👁️"}
                </button>

                {/* Generate button */}
                <button
                  type="button"
                  onClick={() => setIsGeneratorOpen(true)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-sm text-blue-500 hover:text-blue-700 px-2"
                >
                  Generate
                </button>
              </div>

              <input
                type="url"
                placeholder="URL (optional)"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                placeholder="Notes (optional)"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
              />
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600">
                  Save & Decrypt
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); resetForm(); }}
                  className="flex-1 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generator Modal - Unchanged */}
      {isGeneratorOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setIsGeneratorOpen(false)}>
          <div className="bg-white p-6 rounded-lg max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-4">Password Generator</h2>
            <div className="space-y-4">
              <div>
                <label className="block mb-2 font-medium">Length: {generatorOptions.length}</label>
                <input
                  type="range"
                  min="8"
                  max="128"
                  value={generatorOptions.length}
                  onChange={(e) => setGeneratorOptions({ ...generatorOptions, length: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={generatorOptions.includeNumbers}
                  onChange={(e) => setGeneratorOptions({ ...generatorOptions, includeNumbers: e.target.checked })}
                  className="mr-2"
                />
                Include Numbers
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={generatorOptions.includeSymbols}
                  onChange={(e) => setGeneratorOptions({ ...generatorOptions, includeSymbols: e.target.checked })}
                  className="mr-2"
                />
                Include Symbols
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={generatorOptions.excludeAmbiguous}
                  onChange={(e) => setGeneratorOptions({ ...generatorOptions, excludeAmbiguous: e.target.checked })}
                  className="mr-2"
                />
                Exclude Ambiguous Chars (0, O, I, l)
              </label>
              <button onClick={generatePassword} className="w-full bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 mb-4">
                Generate
              </button>
              {generatedPassword && (
                <div className="bg-gray-100 p-3 rounded-lg mb-4">
                  <p className="text-sm font-mono break-all mb-2">Generated: {generatedPassword}</p>
                  <div className="flex gap-2">
                    <button onClick={() => copyToClipboard(generatedPassword, "Generated Password")} className="flex-1 bg-blue-500 text-white py-2 rounded">
                      Copy
                    </button>
                    <button onClick={useGeneratedPassword} className="flex-1 bg-indigo-500 text-white py-2 rounded">
                      Use This
                    </button>
                  </div>
                </div>
              )}
              <button onClick={() => setIsGeneratorOpen(false)} className="w-full bg-gray-500 text-white py-3 rounded">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .slider::-webkit-slider-thumb { appearance: none; height: 20px; width: 20px; border-radius: 50%; background: #3b82f6; cursor: pointer; }
        .slider::-moz-range-thumb { height: 20px; width: 20px; border-radius: 50%; background: #3b82f6; cursor: pointer; border: none; }
      `}</style>
    </div>
  );
};

export default VaultManager;