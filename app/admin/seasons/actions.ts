"use server";

import {
  createSeason,
  deleteSeasonIfAllowed,
  setSeasonActiveState,
  updateSeason,
} from "@/lib/seasons";

function readSeasonId(input: number | FormData): number {
  if (typeof input === "number") {
    return input;
  }

  const rawValue = String(input.get("seasonId") ?? "");
  const seasonId = Number(rawValue);

  if (!Number.isFinite(seasonId) || seasonId <= 0) {
    throw new Error("A valid season ID is required.");
  }

  return seasonId;
}

export async function createSeasonAction(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const startDate = String(formData.get("startDate") ?? "") || null;
  const endDate = String(formData.get("endDate") ?? "") || null;
  const active = formData.get("active") === "on";

  const season = await createSeason({
    name,
    startDate,
    endDate,
    active,
  });

  return { success: true, season };
}

export async function updateSeasonAction(seasonId: number, formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const startDate = String(formData.get("startDate") ?? "") || null;
  const endDate = String(formData.get("endDate") ?? "") || null;
  const active = formData.get("active") === "on";

  const season = await updateSeason(seasonId, {
    name,
    startDate,
    endDate,
    active,
  });

  return { success: true, season };
}

export async function activateSeasonAction(seasonId: number | FormData): Promise<void> {
  const id = readSeasonId(seasonId);
  await setSeasonActiveState(id, true);
}

export async function deactivateSeasonAction(seasonId: number | FormData): Promise<void> {
  const id = readSeasonId(seasonId);
  await setSeasonActiveState(id, false);
}

export async function deleteSeasonAction(seasonId: number | FormData) {
  const id = readSeasonId(seasonId);
  const result = await deleteSeasonIfAllowed(id);
  return result;
}
