#!/usr/bin/env node
/**
 * Quick report tool to view job details from the database
 * Usage: node report-job.js [jobId]
 * Example: node report-job.js <paste-job-id-here>
 */

import mysql from 'mysql2/promise';

const config = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'skillswap',
};

async function reportJob(jobId) {
  const connection = await mysql.createConnection(config);
  
  try {
    // Query job details with poster info
    const [jobs] = await connection.execute(`
      SELECT 
        j.*,
        u.full_name as poster_name,
        u.email as poster_email,
        (SELECT COUNT(*) FROM bids WHERE job_id = j.id) as bid_count
      FROM jobs j
      LEFT JOIN users u ON j.poster_id = u.id
      WHERE j.id = ?
    `, [jobId]);

    if (jobs.length === 0) {
      console.log('\n❌ Job not found:', jobId);
      return;
    }

    const job = jobs[0];
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 JOB REPORT');
    console.log('='.repeat(60));
    console.log(`\n📌 Job ID:        ${job.id}`);
    console.log(`📝 Title:         ${job.title}`);
    console.log(`💰 Budget:        $${job.budget_naira} USD`);
    console.log(`📄 Description:   ${job.description.substring(0, 100)}${job.description.length > 100 ? '...' : ''}`);
    console.log(`\n👤 Poster:        ${job.poster_name} (${job.poster_email})`);
    console.log(`🆔 Poster ID:     ${job.poster_id}`);
    console.log(`\n📊 Bids:          ${job.bid_count} bid${job.bid_count !== 1 ? 's' : ''}`);
    console.log(`📅 Created:       ${new Date(job.created_at).toLocaleString()}`);
    console.log(`✏️  Updated:       ${new Date(job.updated_at).toLocaleString()}`);
    console.log(`🔒 Status:        ${job.status || 'open'}`);
    
    // Get bids if any
    if (job.bid_count > 0) {
      console.log('\n' + '-'.repeat(60));
      console.log('💼 BIDS ON THIS JOB:');
      console.log('-'.repeat(60));
      
      const [bids] = await connection.execute(`
        SELECT 
          b.*,
          u.full_name as bidder_name,
          u.email as bidder_email
        FROM bids b
        LEFT JOIN users u ON b.bidder_id = u.id
        WHERE b.job_id = ?
        ORDER BY b.created_at DESC
      `, [jobId]);

      bids.forEach((bid, index) => {
        console.log(`\n  Bid #${index + 1}:`);
        console.log(`    💰 Amount:   $${bid.amount}`);
        console.log(`    👤 Bidder:   ${bid.bidder_name} (${bid.bidder_email})`);
        console.log(`    💬 Message:  ${bid.message || 'No message'}`);
        console.log(`    📅 Posted:   ${new Date(bid.created_at).toLocaleString()}`);
      });
    }

    console.log('\n' + '='.repeat(60) + '\n');
  } catch (error) {
    console.error('Error fetching job details:', error.message);
  } finally {
    await connection.end();
  }
}

// Get job ID from command line arguments
const jobId = process.argv[2];
if (!jobId) {
  console.log('\n❌ Usage: node report-job.js <jobId>');
  console.log('Example: node report-job.js 123abc456def789\n');
  process.exit(1);
}

reportJob(jobId);
