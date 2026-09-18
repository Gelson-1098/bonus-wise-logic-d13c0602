import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertMaster } from "@/lib/users.server";

type SupabaseLike = Parameters<typeof assertMaster>[0];

type ImportRow = {
  full_name: string;
  store_id: string;
  position_id: string;
  registration?: string | null | undefined;
  cpf?: string | null | undefined;
};

const normalize = (value: string | null | undefined) =>
  (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const digits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

export async function importEmployees(supabase: SupabaseLike, rows: ImportRow[]) {
  const actor = await assertMaster(supabase);
  const [{ data: stores }, { data: positions }, { data: existing }] = await Promise.all([
    supabaseAdmin.from("stores").select("id"),
    supabaseAdmin.from("positions").select("id"),
    supabaseAdmin.from("employees").select("id,full_name,store_id,position_id,registration,cpf"),
  ]);
  const storeIds = new Set((stores ?? []).map((row) => row.id));
  const positionIds = new Set((positions ?? []).map((row) => row.id));
  const registrations = new Set((existing ?? []).map((row) => normalize(row.registration)).filter(Boolean));
  const cpfs = new Set((existing ?? []).map((row) => digits(row.cpf)).filter(Boolean));
  const nameStores = new Set((existing ?? []).map((row) => `${normalize(row.full_name)}|${row.store_id}`));
  const accepted: Array<{
    full_name: string;
    store_id: string;
    position_id: string;
    registration: string | null;
    cpf: string | null;
  }> = [];
  let skipped = 0;

  for (const row of rows) {
    if (!storeIds.has(row.store_id) || !positionIds.has(row.position_id)) throw new Error("Loja ou cargo inválido na importação.");
    const registration = normalize(row.registration);
    const cpf = digits(row.cpf);
    const nameStore = `${normalize(row.full_name)}|${row.store_id}`;
    if ((registration && registrations.has(registration)) || (cpf && cpfs.has(cpf)) || nameStores.has(nameStore)) {
      skipped += 1;
      continue;
    }
    if (registration) registrations.add(registration);
    if (cpf) cpfs.add(cpf);
    nameStores.add(nameStore);
    accepted.push({ ...row, registration: row.registration || null, cpf: cpf || null });
  }

  if (accepted.length) {
    const { error } = await supabaseAdmin.from("employees").insert(accepted);
    if (error) throw new Error(error.message);
  }
  await supabaseAdmin.from("audit_logs").insert({
    user_id: actor.userId || null,
    user_email: actor.email,
    action: "importacao_colaboradores",
    entity: "employees",
    description: `${accepted.length} colaborador(es) importado(s); ${skipped} duplicado(s) ignorado(s).`,
  });
  return { imported: accepted.length, skipped };
}
