const { createClient } = require('@supabase/supabase-js');

// Get environment variables with fallback values
const supabaseUrl = process.env.SUPABASE_URL || 'https://vnedzjklbydlvjbcqlsh.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZuZWR6amtsYnlkbHZqYmNxbHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkzMDQxMCwiZXhwIjoyMDczNTA2NDEwfQ.8cC_ttUN3yiAxj59eM3t_SsCCdzkfs56fpD9jkSOB7s';

// Add better error message for debugging
if (!supabaseUrl || supabaseUrl === 'https://example.supabase.co') {
  console.error('SUPABASE_URL environment variable is missing or invalid');
}

if (!supabaseKey || supabaseKey === 'your-supabase-anon-key') {
  console.error('SUPABASE_KEY environment variable is missing or invalid');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;