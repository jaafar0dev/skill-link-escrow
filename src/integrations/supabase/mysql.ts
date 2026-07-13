type Pool = any;
type RowDataPacket = any;

const LOCAL_AUTH_STORAGE_KEY = 'skillswap-local-auth';

interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

type FilterOp = '=' | '!=' | 'in' | 'like';

type QueryFilter = {
  column: string;
  op: FilterOp;
  value: unknown;
};

type QueryOrder = {
  column: string;
  ascending: boolean;
};

function getDbConfig(): DbConfig {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'skillswap',
  };
}

let poolInstance: Pool | null | undefined;
let poolError: Error | null = null;

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function getPool(): Promise<Pool | null> {
  if (poolInstance !== undefined) return poolInstance;
  if (poolError) return null;
  if (typeof window !== 'undefined') {
    poolInstance = null;
    return null;
  }

  let pool: Pool | null = null;

  try {
    const { createPool } = await import('mysql2/promise');
    const config = getDbConfig();
    pool = createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 2000,
      acquireTimeout: 2000,
      timeout: 2000,
    });

    await withTimeout(pool.query<RowDataPacket[]>('SELECT 1'), 3000, 'MySQL connection timed out');
    await withTimeout(pool.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``), 3000, 'MySQL setup timed out');
    await withTimeout(pool.query(`USE \`${config.database}\``), 3000, 'MySQL database selection timed out');
    poolInstance = pool;
    return pool;
  } catch (error) {
    if (pool) {
      try {
        await pool.end();
      } catch {
        // ignore cleanup errors
      }
    }
    poolError = error as Error;
    console.warn('[MySQL] Falling back to local demo mode:', (error as Error).message);
    return null;
  }
}

async function ensureSchema() {
  const pool = await getPool();
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id VARCHAR(36) PRIMARY KEY,
      full_name VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      role VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id VARCHAR(36) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      poster_id VARCHAR(36) NOT NULL,
      assigned_provider_id VARCHAR(36) NULL,
      budget_naira INT NOT NULL DEFAULT 0,
      final_price_naira INT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bids (
      id VARCHAR(36) PRIMARY KEY,
      job_id VARCHAR(36) NOT NULL,
      provider_id VARCHAR(36) NOT NULL,
      amount_naira INT NOT NULL DEFAULT 0,
      message TEXT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS escrow_transactions (
      id VARCHAR(36) PRIMARY KEY,
      job_id VARCHAR(36) NOT NULL,
      amount_naira INT NOT NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'funded',
      released_at TIMESTAMP NULL,
      released_by VARCHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wallets (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      balance_naira INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      amount_naira INT NOT NULL DEFAULT 0,
      kind VARCHAR(50) NOT NULL,
      note TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id VARCHAR(36) PRIMARY KEY,
      job_id VARCHAR(36) NOT NULL,
      sender_id VARCHAR(36) NOT NULL,
      body TEXT NULL,
      attachment_url TEXT NULL,
      attachment_name TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_reports (
      id VARCHAR(36) PRIMARY KEY,
      job_id VARCHAR(36) NOT NULL,
      reporter_id VARCHAR(36) NOT NULL,
      report_type VARCHAR(50) NOT NULL DEFAULT 'quick_report',
      body TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

function hashPassword(password: string) {
  let hash = 0;
  for (let i = 0; i < password.length; i += 1) {
    hash = (hash << 5) - hash + password.charCodeAt(i);
    hash |= 0;
  }
  return `p${Math.abs(hash).toString(16)}`;
}

function createId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2, 10)}`;
}

function readStoredSession() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    window.localStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
    return null;
  }
}

function persistSession(session: any) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(session));
  }
  return session;
}

function clearSession() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
  }
}

class MysqlQueryBuilder {
  private filters: QueryFilter[] = [];
  private orderBy: QueryOrder | null = null;
  private limitValue: number | null = null;
  private selectColumns = '*';

  constructor(private readonly table: string, private readonly client: MysqlSupabaseCompatibleClient) {}

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null) {
    return this.execute().catch(onrejected);
  }

  select(columns = '*') {
    this.selectColumns = columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, op: '=', value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ column, op: '!=', value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ column, op: 'in', value: values });
    return this;
  }

  ilike(column: string, value: unknown) {
    this.filters.push({ column, op: 'like', value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  async maybeSingle() {
    const result = await this.execute();
    if (result.error) return result;
    return { data: (result.data as any[] | undefined)?.[0] ?? null, error: null };
  }

  async execute() {
    const pool = await getPool();
    if (!pool) {
      return { data: [], error: null };
    }
    await ensureSchema();

    const whereClauses = this.filters.map((filter) => this.toSqlClause(filter)).filter(Boolean);
    const params: unknown[] = this.filters.flatMap((filter) => this.toSqlParams(filter));
    const sql = [
      `SELECT ${this.selectColumns} FROM \`${this.table}\``,
      whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '',
      this.orderBy ? `ORDER BY \`${this.orderBy.column}\` ${this.orderBy.ascending ? 'ASC' : 'DESC'}` : '',
      this.limitValue ? `LIMIT ${this.limitValue}` : '',
    ].filter(Boolean).join(' ');

    const [rows] = await pool.query<RowDataPacket[]>(sql, params);

    return { data: rows as any[], error: null };
  }

  async insert(values: Record<string, unknown>) {
    const pool = await getPool();
    if (!pool) {
      return { data: null, error: null };
    }
    await ensureSchema();

    const payload = { ...values } as Record<string, unknown>;
    if (!payload.id) payload.id = createId();
    if (!payload.created_at) payload.created_at = new Date().toISOString();

    const columns = Object.keys(payload);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO \`${this.table}\` (\`${columns.join('`, `')}\`) VALUES (${placeholders})`;
    const params = columns.map((column) => payload[column]);

    await pool.query(sql, params);
    return { data: payload, error: null };
  }

  async update(values: Record<string, unknown>) {
    const pool = await getPool();
    if (!pool) {
      return { data: null, error: null };
    }
    await ensureSchema();

    if (!this.filters.length) {
      return { data: null, error: null };
    }

    const assignments = Object.keys(values).map((column) => `\`${column}\` = ?`);
    const whereClauses = this.filters.map((filter) => this.toSqlClause(filter)).filter(Boolean);
    const params = [...Object.values(values), ...this.filters.flatMap((filter) => this.toSqlParams(filter))];
    const sql = `UPDATE \`${this.table}\` SET ${assignments.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
    await pool.query(sql, params);
    return { data: { updated: true }, error: null };
  }

  private toSqlClause(filter: QueryFilter) {
    const column = `\`${filter.column}\``;
    switch (filter.op) {
      case '=':
        return `${column} = ?`;
      case '!=':
        return `${column} != ?`;
      case 'in':
        return `${column} IN (${(filter.value as unknown[]).map(() => '?').join(', ')})`;
      case 'like':
        return `${column} LIKE ?`;
      default:
        return `${column} = ?`;
    }
  }

  private toSqlParams(filter: QueryFilter) {
    switch (filter.op) {
      case 'in':
        return filter.value as unknown[];
      case 'like':
        return [filter.value];
      default:
        return [filter.value];
    }
  }
}

export class MysqlSupabaseCompatibleClient {
  from(table: string) {
    return new MysqlQueryBuilder(table, this);
  }

  auth = {
    async onAuthStateChange(callback: (event: string, session: any) => void) {
      const initialSession = readStoredSession();
      callback('INITIAL_SESSION', initialSession ?? null);
      return { data: { subscription: { unsubscribe() {} } } };
    },
    async getSession() {
      return { data: { session: readStoredSession() ?? null }, error: null };
    },
    async getUser() {
      const session = readStoredSession();
      return { data: { user: session?.user ?? null }, error: null };
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      if (!email || !password) {
        return { data: { user: null, session: null }, error: { message: 'Email and password are required.' } };
      }

      const pool = await getPool();
      if (!pool) {
        return { data: { user: null, session: null }, error: { message: 'MySQL is not available yet.' } };
      }
      await ensureSchema();

      const [rows] = await pool.query<RowDataPacket[]>('SELECT id, email, full_name FROM users WHERE email = ? AND password_hash = ?', [email, hashPassword(password)]);
      const userRow = rows[0] as any;
      if (!userRow) {
        return { data: { user: null, session: null }, error: { message: 'Invalid email or password.' } };
      }

      const session = persistSession({
        user: { id: userRow.id, email: userRow.email, user_metadata: { full_name: userRow.full_name ?? email.split('@')[0] } },
        access_token: `mysql-${createId()}`,
        refresh_token: `mysql-${createId()}`,
      });
      return { data: { user: session.user, session }, error: null };
    },
    async signUp({ email, password, options }: { email: string; password: string; options?: any }) {
      if (!email || !password || password.length < 6) {
        return { data: { user: null, session: null }, error: { message: 'Password must be at least 6 characters.' } };
      }

      const pool = await getPool();
      if (!pool) {
        return { data: { user: null, session: null }, error: { message: 'MySQL is not available yet.' } };
      }
      await ensureSchema();

      const userId = createId();
      const fullName = options?.data?.full_name || email.split('@')[0];
      const role = options?.data?.role || 'poster';

      try {
        await pool.query('INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)', [userId, email, hashPassword(password), fullName]);
        await pool.query('INSERT INTO profiles (id, full_name) VALUES (?, ?)', [userId, fullName]);
        await pool.query('INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)', [createId(), userId, role]);
      } catch (error: any) {
        if (error?.code === 'ER_DUP_ENTRY') {
          return { data: { user: null, session: null }, error: { message: 'An account with this email already exists.' } };
        }
        throw error;
      }

      const session = persistSession({
        user: { id: userId, email, user_metadata: { full_name: fullName } },
        access_token: `mysql-${createId()}`,
        refresh_token: `mysql-${createId()}`,
      });
      return { data: { user: session.user, session }, error: null };
    },
    async signOut() {
      clearSession();
      return { error: null };
    },
    async getClaims(token: string) {
      const session = readStoredSession();
      if (!session?.user?.id) {
        return { data: { claims: null }, error: { message: 'Invalid token.' } };
      }
      return { data: { claims: { sub: session.user.id } }, error: null };
    },
  };

  storage = {
    from(bucket: string) {
      return {
        async upload(path: string, _file: File | Blob, _options?: unknown) {
          return { data: { path }, error: null };
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `http://localhost:8080/storage/${bucket}/${path}` }, error: null };
        },
      };
    },
  };

  channel(_name: string) {
    const channel = {
      on: () => channel,
      subscribe: () => channel,
    };
    return channel;
  }

  removeChannel(_channel: unknown) {
    return true;
  }
}

export function createMysqlSupabaseCompatibleClient() {
  return new MysqlSupabaseCompatibleClient();
}
