"use client";

import React, { useState, useEffect, useRef } from "react";
import { encryptData, decryptData, safeParseJson } from "@/lib/crypto";
import { useTheme } from "../content/ThemeContext";
// Note: Interfaces and utility imports are kept the same for brevity and focused on the component structure.

interface EncryptedVaultItem {
  _id: string;
  userId: string;
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  tags: string[];
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
  tags: string[];
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
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<EncryptedVaultItem[] | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [currentEditId, setCurrentEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    username: "",
    password: "",
    url: "",
    notes: "",
    tags: [] as string[],
  });
  const [toast, setToast] = useState({ message: "", type: "" as ToastType });
  const [generatorOptions, setGeneratorOptions] = useState({
    length: 16,
    includeNumbers: true,
    includeSymbols: true,
    excludeAmbiguous: true,
  });
  const { theme } = useTheme();
  const [generatedPassword, setGeneratedPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [visiblePasswordIds, setVisiblePasswordIds] = useState<Record<string, boolean>>({});
  const [showFormPassword, setShowFormPassword] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Utility Functions (Kept the same) ---

  const toggleVaultPassword = (id: string) => {
    setVisiblePasswordIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleFormPassword = () => setShowFormPassword((s) => !s);

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tags = e.target.value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    setFormData({ ...formData, tags });
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`${API_BASE}/vault/export/${userId}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `vault_${userId}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        setToast({ message: "Vaults exported successfully!", type: "success" });
      } else {
        setToast({ message: "Failed to export vaults", type: "error" });
      }
    } catch (error) {
      console.error("Error exporting vaults:", error);
      setToast({ message: "Export error", type: "error" });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setImportPreview(null);
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const vaults = JSON.parse(event.target?.result as string);
        if (!Array.isArray(vaults)) {
          setToast({ message: "Invalid file format: Must be an array of vaults", type: "error" });
          setImportPreview(null);
          return;
        }
        const validVaults = vaults.filter((vault) =>
          vault._id &&
          vault.userId &&
          vault.title &&
          vault.username &&
          vault.password &&
          Array.isArray(vault.tags)
        );
        setImportPreview(validVaults as EncryptedVaultItem[]);
        if (validVaults.length !== vaults.length) {
          setToast({ message: "Some vault items were invalid and skipped", type: "info" });
        }
      } catch (error) {
        console.error("Error parsing file:", error);
        setToast({ message: "Invalid JSON file", type: "error" });
        setImportPreview(null);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!selectedFile || !importPreview) {
      setToast({ message: "No valid file selected", type: "error" });
      return;
    }

    setIsImporting(true);
    try {
      const response = await fetch(`${API_BASE}/vault/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, vaults: importPreview }),
      });

      if (response.ok) {
        const { count, skipped } = await response.json();
        if (count === 0) {
          setToast({ message: `${skipped || importPreview.length} vaults already exist in the database!`, type: "info" });
        } else {
          await fetchAndDecryptVaults();
          let msg = `${count} vault${count === 1 ? '' : 's'} imported successfully!`;
          if (skipped > 0) msg += ` (${skipped} skipped)`;
          setToast({ message: msg, type: "success" });
        }
        setIsImportModalOpen(false);
        setSelectedFile(null);
        setImportPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        const errorText = await response.text();
        setToast({ message: `Import failed: ${errorText}`, type: "error" });
      }
    } catch (error) {
      console.error("Error importing vaults:", error);
      setToast({ message: "Import error", type: "error" });
    } finally {
      setIsImporting(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchAndDecryptVaults();
    }
  }, [userId]);

  useEffect(() => {
    const filtered = decryptedVaults.filter(
      (vault) =>
        vault.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vault.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vault.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
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

        const decryptedData = await Promise.all(
          encryptedData.map(async (vault) => {
            let decryptedUsername = "[No Username]";
            let decryptedPassword = "[No Password]";
            let isLegacy = false;

            const usernameParsed = safeParseJson(vault.username);
            if (usernameParsed && typeof usernameParsed === "object" && 'cipherText' in usernameParsed && 'salt' in usernameParsed && 'iv' in usernameParsed) {
              try {
                decryptedUsername = await decryptData(usernameParsed, userId);
              } catch {
                decryptedUsername = "[Encrypted - Edit to decrypt]";
                isLegacy = true;
              }
            } else if (vault.username && vault.username.length < 50 && !vault.username.startsWith("{") && !vault.username.startsWith("\"{")) {
              decryptedUsername = vault.username;
              isLegacy = true;
              console.warn(`Plaintext legacy username for vault ${vault._id}`);
            } else {
              decryptedUsername = vault.username || decryptedUsername;
              isLegacy = true;
            }

            const passwordParsed = safeParseJson(vault.password);
            if (passwordParsed && typeof passwordParsed === "object" && 'cipherText' in passwordParsed && 'salt' in passwordParsed && 'iv' in passwordParsed) {
              try {
                decryptedPassword = await decryptData(passwordParsed, userId);
              } catch {
                decryptedPassword = "[Encrypted - Edit to decrypt]";
                isLegacy = true;
              }
            } else if (vault.password && vault.password.length < 50 && !vault.password.startsWith("{") && !vault.password.startsWith("\"{")) {
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
              tags: vault.tags || [],
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
        tags: formData.tags,
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
      tags: vault.tags || [],
    });
    setCurrentEditId(vault._id);
    setIsEditModalOpen(true);
    if (vault.isLegacy) {
      setToast({ message: "Legacy loaded. Edit & save to decrypt with your account key.", type: "info" });
    }
  };

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
    setFormData({ title: "", username: "", password: "", url: "", notes: "", tags: [] });
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

  // --- Rendering Logic ---

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
    <div
      className={`min-h-screen p-4 sm:p-6 transition-colors duration-500 ${theme === "dark"
          ? "bg-gray-400"
          : "bg-blue-100"
        }`}
    >
      <h1 className="text-xl sm:text-3xl font-bold mb-6">Password Vault ({decryptedVaults.length} entries)</h1>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by title, username, or tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
        />
      </div>

      {/* Primary Action Buttons: Changed to flex-wrap and smaller buttons on mobile */}
      <div className="flex flex-wrap gap-2 sm:gap-4 mb-6">
        <button
          onClick={() => {
            resetForm();
            setIsAddModalOpen(true);
          }}
          className="bg-blue-500 text-white px-3 py-2 text-sm sm:px-4 sm:py-2 rounded-lg hover:bg-blue-600 flex-1 min-w-[100px] sm:flex-initial"
        >
          ➕ New Entry
        </button>
        <button
          onClick={handleExport}
          className="bg-green-500 text-white px-3 py-2 text-sm sm:px-4 sm:py-2 rounded-lg hover:bg-green-600 flex-1 min-w-[100px] sm:flex-initial"
        >
          ⬇️ Export Vaults
        </button>
        <button
          onClick={() => setIsImportModalOpen(true)}
          className="bg-purple-500 text-white px-3 py-2 text-sm sm:px-4 sm:py-2 rounded-lg hover:bg-purple-600 flex-1 min-w-[100px] sm:flex-initial"
        >
          ⬆️ Import Vaults
        </button>
      </div>

      <div className="grid gap-4">
        {filteredVaults.length > 0 ? (
          filteredVaults.map((vault) => (
            // Vault Card: Added 'overflow-hidden' and adjusted internal flex for mobile stacking
            <div key={vault._id} className="bg-white p-4 rounded-lg shadow-md border overflow-hidden">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className="flex-1 min-w-0 mb-3 sm:mb-0">
                  <h3 className="text-lg font-semibold truncate">{vault.title}</h3>
                  <p className="text-gray-600 text-sm truncate" title={vault.username}>
                    Username: {vault.username} {vault.isLegacy && <span className="text-yellow-600 text-xs">(Edit to decrypt)</span>}
                  </p>
                  {vault.password !== "[No Password]" && (
                    <p className="text-gray-600 text-xs flex items-center gap-2 mt-1">
                      <span className="truncate">
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
                    <p className="text-xs text-blue-500 mt-1 truncate">
                      <a href={vault.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {vault.url}
                      </a>
                    </p>
                  )}
                  {vault.notes && <p className="text-xs text-gray-500 mt-2 line-clamp-2">{vault.notes}</p>}
                  {vault.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {vault.tags.map((tag, index) => (
                        <span key={index} className="bg-blue-100 text-blue-800 text-xs font-medium px-1.5 py-0.5 rounded truncate max-w-[100px]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons: Changed to flex-wrap with margin-top for mobile */}
                <div className="flex flex-wrap gap-1 sm:gap-2 sm:ml-4 flex-shrink-0 mt-3 sm:mt-0">
                  <button
                    onClick={() => copyToClipboard(vault.username, "Username")}
                    title="Copy Username"
                    className="text-green-500 hover:text-green-700 p-1 rounded text-lg"
                  >
                    📋
                  </button>
                  <button
                    onClick={() => copyToClipboard(vault.password, "Password")}
                    title="Copy Password"
                    className="text-green-500 hover:text-green-700 p-1 rounded text-lg"
                  >
                    🔑
                  </button>
                  <button onClick={() => handleEdit(vault)} className="text-blue-500 hover:text-blue-700 px-2 py-1 rounded text-xs sm:text-sm border border-blue-500">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(vault._id)} className="text-red-500 hover:text-red-700 px-2 py-1 rounded text-xs sm:text-sm border border-red-500">
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
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 text-sm sm:text-base ${toast.type === "success" ? "bg-green-500" : toast.type === "error" ? "bg-red-500" : "bg-blue-500"} text-white`}>
          {toast.message}
        </div>
      )}

      {/* Add/Edit Modal: Added min-h-full and max-w-full on mobile (sm:max-w-md) */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-0 sm:p-4 z-50" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}>
          <div className="bg-white p-6 rounded-none sm:rounded-lg max-w-full w-full sm:max-w-md max-h-screen sm:max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-4">{currentEditId ? "Edit Entry" : "Add Entry"}</h2>
            <div className="space-y-3">
              {/* Form fields are already w-full and responsive */}
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
                <button
                  type="button"
                  onClick={toggleFormPassword}
                  className="absolute right-20 top-1/2 transform -translate-y-1/2 text-sm text-gray-600 hover:text-gray-800 px-1 sm:px-2"
                  title={showFormPassword ? "Hide password" : "Show password"}
                >
                  {showFormPassword ? "🙈" : "👁️"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsGeneratorOpen(true)}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 text-xs sm:text-sm text-blue-500 hover:text-blue-700 px-1 sm:px-2"
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
              <input
                type="text"
                placeholder="Tags (comma-separated, optional)"
                value={formData.tags.join(", ")}
                onChange={handleTagsChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                placeholder="Notes (optional)"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
              />
              {/* Modal Action Buttons: Made full-width (flex-1) */}
              <div className="flex gap-3 pt-2">
                <button onClick={handleSubmit} className="flex-1 bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 text-sm sm:text-base">
                  Save & Decrypt
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); resetForm(); }}
                  className="flex-1 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 text-sm sm:text-base"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal: Applied similar responsiveness as Add/Edit Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-0 sm:p-4 z-50" onClick={() => setIsImportModalOpen(false)}>
          <div className="bg-white p-6 rounded-none sm:rounded-lg max-w-full w-full sm:max-w-md max-h-screen sm:max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-4">Import Vaults</h2>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Select a JSON file containing encrypted vaults to import.</p>
              <input
                type="file"
                accept="application/json"
                onChange={handleFileSelect}
                ref={fileInputRef}
                className="w-full p-3 border border-gray-300 rounded-lg"
                disabled={isImporting}
              />
              {selectedFile && (
                <p className="text-sm text-gray-600 truncate">Selected: {selectedFile.name}</p>
              )}
              {importPreview && (
                <div className="bg-gray-100 p-3 rounded-lg">
                  <p className="text-sm font-semibold mb-2">Preview ({importPreview.length} vaults):</p>
                  <ul className="text-xs text-gray-600 max-h-40 overflow-y-auto">
                    {importPreview.map((vault, index) => (
                      <li key={index} className="truncate">
                        {vault.title} (Username: {vault.username.slice(0, 20)}...)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {isImporting && (
                <p className="text-sm text-blue-600">Importing...</p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleImport}
                  disabled={!selectedFile || !importPreview || isImporting}
                  className={`flex-1 py-3 rounded-lg text-sm sm:text-base ${selectedFile && importPreview && !isImporting
                      ? "bg-blue-500 text-white hover:bg-blue-600"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                >
                  {isImporting ? "Importing..." : "Import"}
                </button>
                <button
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setSelectedFile(null);
                    setImportPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="flex-1 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 text-sm sm:text-base"
                  disabled={isImporting}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generator Modal: Applied similar responsiveness as Add/Edit Modal */}
      {isGeneratorOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-0 sm:p-4 z-50" onClick={() => setIsGeneratorOpen(false)}>
          <div className="bg-white p-6 rounded-none sm:rounded-lg max-w-full w-full sm:max-w-md" onClick={(e) => e.stopPropagation()}>
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
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={generatorOptions.includeNumbers}
                  onChange={(e) => setGeneratorOptions({ ...generatorOptions, includeNumbers: e.target.checked })}
                  className="mr-2"
                />
                Include Numbers
              </label>
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={generatorOptions.includeSymbols}
                  onChange={(e) => setGeneratorOptions({ ...generatorOptions, includeSymbols: e.target.checked })}
                  className="mr-2"
                />
                Include Symbols
              </label>
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={generatorOptions.excludeAmbiguous}
                  onChange={(e) => setGeneratorOptions({ ...generatorOptions, excludeAmbiguous: e.target.checked })}
                  className="mr-2"
                />
                Exclude Ambiguous Chars (0, O, I, l)
              </label>
              <button onClick={generatePassword} className="w-full bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 mb-4 text-sm sm:text-base">
                Generate
              </button>
              {generatedPassword && (
                <div className="bg-gray-100 p-3 rounded-lg mb-4">
                  <p className="text-sm font-mono break-all mb-2">Generated: {generatedPassword}</p>
                  <div className="flex gap-2">
                    <button onClick={() => copyToClipboard(generatedPassword, "Generated Password")} className="flex-1 bg-blue-500 text-white py-2 rounded text-sm sm:text-base">
                      Copy
                    </button>
                    <button onClick={useGeneratedPassword} className="flex-1 bg-indigo-500 text-white py-2 rounded text-sm sm:text-base">
                      Use This
                    </button>
                  </div>
                </div>
              )}
              <button onClick={() => setIsGeneratorOpen(false)} className="w-full bg-gray-500 text-white py-3 rounded text-sm sm:text-base">
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
