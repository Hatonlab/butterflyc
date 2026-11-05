import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertMembersStaff(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_section", { _uid: userId, _section: "members" });
  if (!data) throw new Error("غير مصرح");
}

async function assertNotOwner(target: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("id").eq("user_id", target).eq("role", "owner");
  if (data && data.length) throw new Error("لا يمكن تعديل حساب المالك");
  return supabaseAdmin;
}

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertMembersStaff(context.supabase, context.userId);
    const admin = await assertNotOwner(data.userId);
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; password: string }) => {
    if (!d.password || d.password.length < 6) throw new Error("كلمة السر قصيرة");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertMembersStaff(context.supabase, context.userId);
    const admin = await assertNotOwner(data.userId);
    const { error } = await admin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
