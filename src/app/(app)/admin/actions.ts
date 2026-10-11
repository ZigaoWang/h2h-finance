"use server";

import {
  changeAdminPassword,
  deleteCategory,
  deleteEvent,
  deleteYear,
  changeTeamPassword,
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

export async function changeTeamPasswordAction(password: string) {
  const admin = await requireAdmin();
  return mutate(() => changeTeamPassword(admin, password));
}

export async function changeAdminPasswordAction(current: string, next: string) {
  const admin = await requireAdmin();
  return mutate(() => changeAdminPassword(admin, current, next));
}

export async function deleteCategoryAction(id: number) {
  const admin = await requireAdmin();
  return mutate(() => deleteCategory(admin, id));
}

export async function deleteEventAction(id: number) {
  const admin = await requireAdmin();
  return mutate(() => deleteEvent(admin, id));
}

export async function deleteYearAction(id: number) {
  const admin = await requireAdmin();
  return mutate(() => deleteYear(admin, id));
}
