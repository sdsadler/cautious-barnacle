import { createSupabaseServerClient } from "@/lib/supabase";

export async function getCurrentSessionUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function isCurrentUserAdmin() {
  const user = await getCurrentSessionUser();

  if (!user) {
    return false;
  }

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  return Boolean(profile?.is_admin);
}

export async function getCurrentAdminUser() {
  const user = await getCurrentSessionUser();

  if (!user) {
    return null;
  }

  if (!(await isCurrentUserAdmin())) {
    return null;
  }

  return user;
}
