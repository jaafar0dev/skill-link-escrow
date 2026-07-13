#!/usr/bin/env node
/**
 * List all jobs in the database
 */

import mysql from 'mysql2/promise';

const config = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'skillswap',
};

async function listJobs() {
  const connection = await mysql.createConnection(config);
  
  try {
    const [jobs] = await connection.execute(`
      SELECT 
        id,
        title,
        budget_naira,
        poster_id,
        created_at
      FROM jobs
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (jobs.length === 0) {
      console.log('\n📭 No jobs found in database\n');
      return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('📋 RECENT JOBS (Latest 10)');
    console.log('='.repeat(80));
    
    jobs.forEach((job, idx) => {
      console.log(`\n${idx + 1}. ${job.title}`);
      console.log(`   ID: ${job.id}`);
      console.log(`   Budget: $${job.budget_naira}`);
      console.log(`   Poster ID: ${job.poster_id}`);
      console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
      console.log(`\n   👉 View details: node report-job.js ${job.id}`);
    });

    console.log('\n' + '='.repeat(80) + '\n');
  } catch (error) {
    console.error('Error fetching jobs:', error.message);
  } finally {
    await connection.end();
  }
}

listJobs();
