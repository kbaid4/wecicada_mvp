import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oesorptwsvoydqhmkbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lc29ycHR3c3ZveWRxaG1rYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MTg1MjYsImV4cCI6MjA2NDA5NDUyNn0.pQXEAnFIUqs-iTE2awWcadT1UZY6G_v3Wl7I65x4cUw';

export const supabase = createClient(supabaseUrl, supabaseKey);
