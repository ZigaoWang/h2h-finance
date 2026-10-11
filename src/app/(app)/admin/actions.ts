"use server";

import {
  saveCategory,
  saveEvent,
  saveMember,
  saveYear,
  setCategoryArchived,
  setEventArchived,
  setMemberRemoved,
  setPublicPage,
} from "@/lib/admin";
import { requireAdmin } from "@/lib/auth/dal";
import { mutate } from "@/lib/mutate";

export async function saveYearAction(input: Record<string, string>) {
  const admin = await requireAdmin();
  return mutate(() => saveYear(admin, input));
}

export async function saveCategoryAction(input: Record<string, string>) {
  const admin = await requireAdmin();
  return mutate(() => saveCategory(admin, input));
}

export async function archiveCategoryAction(id: number, archived: boolean) {
  const admin = await requireAdmin();
  return mutate(() => setCategoryArchived(admin, id, archived));
}

export async function saveEventAction(input: Record<string, string>) {
  const admin = await requireAdmin();
  return mutate(() => saveEvent(admin, input));
}

export async function archiveEventAction(id: number, archived: boolean) {
  const admin = await requireAdmin();
  return mutate(() => setEventArchived(admin, id, archived));
}

export async function saveMemberAction(input: Record<string, string>) {
  const admin = await requireAdmin();
  return mutate(() => saveMember(admin, input));
}

export async function removeMemberAction(id: number, removed: boolean) {
  const admin = await requireAdmin();
  return mutate(() => setMemberRemoved(admin, id, removed));
}

export async function setPublicPageAction(enabled: boolean) {
  const admin = await requireAdmin();
  return mutate(() => setPublicPage(admin, enabled));
}
