// app/components/Navbar.tsx
"use client";

import { signOut } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { toast } from "react-toastify";

const Navbar = () => {
  const router = useRouter();

  const handleLogout = async () => {
    const uid = auth.currentUser?.uid;
    try {
      await signOut(auth);
      if (uid) {
        localStorage.removeItem(`vaultVerified_${uid}`);
      }
      toast.success("Logged out successfully!");
      router.push("/");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <nav className="bg-blue-600 p-4 text-white">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/vault" className="font-bold text-xl">Secure Vault</Link>
        <div className="space-x-4">
          <Link href="/auth/security-settings" className="hover:underline">Security Settings</Link>
          <Link href="/vault" className="hover:underline">Vault</Link>
          <button onClick={handleLogout} className="hover:underline">Logout</button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;