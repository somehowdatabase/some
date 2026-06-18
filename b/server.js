require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { Resend } = require('resend');

const app = express();
app.use(express.json());
app.use(cors()); // Allows your frontend to talk to this backend

// 1. Connect to PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Render/Vercel hosted DBs
  }
});

// 2. Create the 'leads' table if it doesn't exist
pool.query(`
  CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    project_type VARCHAR(100),
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).catch(err => console.error("Table creation error:", err));

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

app.post('/api/submit-lead', async (req, res) => {
  const { name, email, project_type, message } = req.body;

  try {
    // 3. Save to PostgreSQL Database
    const result = await pool.query(
      "INSERT INTO leads (name, email, project_type, message) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, email, project_type, message]
    );

    // 4. Send Email Notification to the Owner (YOU)
    const { data, error } = await resend.emails.send({
      from: 'Your Studio <onboarding@resend.dev>', // Use 'onboarding@resend.dev' for free tier
      to: [process.env.OWNER_EMAIL], // Your real email
      subject: '🚀 New Lead from Somehow Website!',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; padding: 20px; background: #f9f9f9; border: 1px solid #ddd;">
          <h2 style="color: #0f172a;">New Lead Received</h2>
          <hr style="border: 0; border-top: 2px solid #00E5FF; margin: 20px 0;">
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Project Type:</strong> ${project_type}</p>
          <p><strong>Message:</strong><br>${message}</p>
          <hr style="border: 0; border-top: 1px solid #ccc; margin: 20px 0;">
          <p style="color: #555; font-size: 12px;">Sent from Somehow Studio Lead Form</p>
        </div>
      `
    });

    if (error) {
      console.error('Resend Error:', error);
      // Even if email fails, we still return success for the DB insert
    }

    res.status(200).json({ success: true, message: 'Lead saved and emailed!' });

  } catch (err) {
    console.error('Server Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));