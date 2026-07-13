import { createMysqlSupabaseCompatibleClient } from './mysql';

async function main() {
  const client = createMysqlSupabaseCompatibleClient();
  const { data: users, error } = await client.from('users').select('*').limit(5).execute();
  console.log('users', users, error);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
