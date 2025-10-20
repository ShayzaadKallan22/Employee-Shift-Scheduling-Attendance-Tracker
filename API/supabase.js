const { createClient } = require('@supabase/supabase-js');

// Get environment variables with fallback values
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Add better error message for debugging
if (!supabaseUrl || supabaseUrl === 'https://example.supabase.co') {
  console.error('SUPABASE_URL environment variable is missing or invalid');
}

if (!supabaseKey || supabaseKey === 'your-supabase-anon-key') {
  console.error('SUPABASE_KEY environment variable is missing or invalid');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;