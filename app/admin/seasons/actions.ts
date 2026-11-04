"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createSeason,
  deleteSeasonIfAllowed,
  setSeasonActiveState,
  updateSeason,
} from "@/lib/seasons";
import { createSupabaseServerClient } from "@/lib/supabase";

function readSeasonId(input: number | FormData): number {
  const seasonId = typeof input === "number"
    ? input
    : Number(String(input.get("seasonId") ?? ""));

  if (!Number.isFinite(seasonId) || seasonId <= 0) {
    throw new Error("A valid season ID is required.");
  }

  return seasonId;
}

async function requireAdminClient() {
  const client = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await client.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("You must be signed in to manage seasons.");
  }

  const { data: profile, error: profileError } = await client
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile?.is_admin) {
    throw new Error("Admin access is required to manage seasons.");
  }

  return client;
}

function revalidateSeasonViews(seasonId: number) {
  revalidatePath("/admin/seasons");
  revalidatePath(`/admin/seasons/${seasonId}`);
}

export async function createSeasonAction(formData: FormData) {
  const client = await requireAdminClient();
  const name = String(formData.get("name") ?? "");
  const startDate = String(formData.get("startDate") ?? "") || null;
  const endDate = String(formData.get("endDate") ?? "") || null;
  const active = formData.get("active") === "on";

  const season = await createSeason({
    name,
    startDate,
    endDate,
    active,
  }, client);

  revalidatePath("/admin/seasons");
  return { success: true, season };
}

export async function updateSeasonAction(seasonId: number, formData: FormData) {
  const id = readSeasonId(seasonId);
  const client = await requireAdminClient();
  const name = String(formData.get("name") ?? "");
  const startDate = String(formData.get("startDate") ?? "") || null;
  const endDate = String(formData.get("endDate") ?? "") || null;
  const active = formData.get("active") === "on";

  const season = await updateSeason(id, {
    name,
    startDate,
    endDate,
    active,
  }, client);

  revalidateSeasonViews(id);
  return { success: true, season };
}

export async function activateSeasonAction(seasonId: number | FormData): Promise<void> {
  const id = readSeasonId(seasonId);
  const client = await requireAdminClient();
  await setSeasonActiveState(id, true, client);
  revalidateSeasonViews(id);
}

export async function deactivateSeasonAction(seasonId: number | FormData): Promise<void> {
  const id = readSeasonId(seasonId);
  const client = await requireAdminClient();
  await setSeasonActiveState(id, false, client);
  revalidateSeasonViews(id);
}

export async function deleteSeasonAction(seasonId: number | FormData) {
  const id = readSeasonId(seasonId);
  const client = await requireAdminClient();
  const result = await deleteSeasonIfAllowed(id, client);

  if (result.ok) {
    revalidateSeasonViews(id);
  }

  return result;
}

export async function deleteSeasonDetailAction(formData: FormData): Promise<void> {
  const id = readSeasonId(formData);
  const client = await requireAdminClient();
  const result = await deleteSeasonIfAllowed(id, client);

  if (!result.ok) {
    throw new Error(result.message);
  }

  revalidateSeasonViews(id);
  redirect("/admin/seasons");
}
