import { createMysqlSupabaseCompatibleClient } from './mysql';

let _supabase: ReturnType<typeof createMysqlSupabaseCompatibleClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createMysqlSupabaseCompatibleClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createMysqlSupabaseCompatibleClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});

