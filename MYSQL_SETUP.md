# XAMPP MySQL setup for SkillSwap

## 1. Install XAMPP
- Download and install XAMPP from https://www.apachefriends.org/
- Start the MySQL service from the XAMPP control panel.

## 2. Create the database
Open phpMyAdmin or the MySQL shell and run:

```sql
CREATE DATABASE skillswap;
```

## 3. Configure environment variables
Create a file named `.env` in the project root with:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=skillswap
```

If you use a non-root MySQL user, replace `root` and the password accordingly.

## 4. Install dependencies
Run:

```bash
npm install
```

## 5. Start the app
Run:

```bash
npm run dev
```

The app will now use XAMPP MySQL automatically. The first time it connects, it will create the required tables.

## 6. Optional: verify the connection
You can test the adapter with:

```bash
npx tsx src/integrations/supabase/mysql-test.ts
```

If MySQL is running and the credentials are correct, the script will connect successfully.
