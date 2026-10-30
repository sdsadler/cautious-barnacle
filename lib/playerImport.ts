import { supabase } from "./supabase";

export async function getActiveSeason() {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("active", true)
    .single();

  if (error) throw error;

  return data;
}