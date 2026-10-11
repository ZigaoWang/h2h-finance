"use server";

import { redirect } from "next/navigation";
import { clearUnlock, chooseName, currentUnlock, registerName, signInNames, unlock } from "@/lib/auth/sign-in";
import { createSession, destroySession } from "@/lib/auth/session";
import { clientIp } from "@/lib/request";

type Name = { id: number; name: string; role: "member" | "admin" };

export type LoginState =
  | { step: "password"; error?: "wrong_password" | "throttled" | "expired" }
  | {
      step: "name";
      names: Name[];
      adminUnlocked: boolean;
      selected?: number;
      newName?: string;
      error?: "admin_password" | "throttled" | "not_found" | "invalid_name" | "name_taken" | "too_many_new";
    };

export async function login(state: LoginState, formData: FormData): Promise<LoginState> {
  const ip = (await clientIp()) ?? "unknown";

  switch (formData.get("intent")) {
    case "unlock": {
      const result = await unlock(String(formData.get("password") ?? ""), ip);
      if (result === "throttled") return { step: "password", error: "throttled" };
      if (!result) return { step: "password", error: "wrong_password" };
      return { step: "name", names: signInNames(), adminUnlocked: result === "admin" };
    }
    case "choose": {
      const userId = Number(formData.get("userId"));
      const result = await chooseName(userId, String(formData.get("adminPassword") ?? ""), ip);
      if (!result.ok) {
        if (result.error === "expired") return { step: "password", error: "expired" };
        const unlocked = await currentUnlock();
        return { step: "name", names: signInNames(), adminUnlocked: unlocked === "admin", selected: userId, error: result.error };
      }
      await createSession(result.userId);
      redirect("/dashboard");
    }
    case "register": {
      const newName = String(formData.get("newName") ?? "");
      const result = await registerName(newName);
      if (!result.ok) {
        if (result.error === "expired") return { step: "password", error: "expired" };
        const unlocked = await currentUnlock();
        return { step: "name", names: signInNames(), adminUnlocked: unlocked === "admin", newName, error: result.error };
      }
      await createSession(result.userId);
      redirect("/dashboard");
    }
    default:
      await clearUnlock();
      return { step: "password" };
  }
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}
