import { createMysqlSupabaseCompatibleClient } from './mysql';

let _supabaseAdmin: ReturnType<typeof createMysqlSupabaseCompatibleClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createMysqlSupabaseCompatibleClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createMysqlSupabaseCompatibleClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
