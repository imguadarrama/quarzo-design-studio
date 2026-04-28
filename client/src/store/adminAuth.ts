import { create } from "zustand";
import type { AdminUser } from "../lib/types.js";
import {
  fetchAdminSession,
  loginAdmin,
  logoutAdmin,
} from "../services/api/admin.js";

export type AdminAuthStatus = "idle" | "loading" | "auth" | "guest";

type AdminAuthState = {
  admin: AdminUser | null;
  status: AdminAuthStatus;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  admin: null,
  status: "idle",
  hydrate: async () => {
    set({ status: "loading" });
    try {
      const admin = await fetchAdminSession();
      if (admin === null) {
        set({ admin: null, status: "guest" });
      } else {
        set({ admin, status: "auth" });
      }
    } catch (error) {
      console.error("[adminAuth] hydrate failed", error);
      set({ admin: null, status: "guest" });
    }
  },
  login: async (email, password) => {
    const admin = await loginAdmin(email, password);
    set({ admin, status: "auth" });
  },
  logout: async () => {
    await logoutAdmin();
    set({ admin: null, status: "guest" });
  },
}));
