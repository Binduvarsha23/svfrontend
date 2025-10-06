"use client";

import { signOut } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { toast } from "react-toastify";
import { useTheme } from "@/content/ThemeContext";
import { Sun, Moon } from "lucide-react";

const Navbar = () => {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    const uid = auth.currentUser?.uid; // capture uid first
    if (!uid) {
      toast.error("No user signed in.");
      router.push("/");
      return;
    }

    try {
      await signOut(auth); // sign out Firebase
      localStorage.removeItem(`vaultVerified_${uid}`); // remove localStorage
      toast.success("Logged out successfully!");
      router.push("/"); // redirect
    } catch (error: any) {
      toast.error(error?.message || "Logout failed");
    }
  };

  return (
    <nav
      className={`p-4 transition-all duration-300 shadow-md ${
        theme === "dark" ? "bg-gray-900 text-white" : "bg-blue-600 text-white"
      }`}
    >
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/vault" className="font-bold text-xl">
          Secure Vault
        </Link>

        <div className="flex items-center gap-4">
          <Link href="/vault" className="hover:underline">
            Vault
          </Link>
          <button onClick={handleLogout} className="hover:underline">
            Logout
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="ml-3 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            title="Toggle Theme"
          >
            {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

