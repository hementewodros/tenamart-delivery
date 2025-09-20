require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

(async () => {
  const { data, error } = await supabase.from('deliveries').insert([{ id: 'TEST1', callback: 'abc', pharmacist: 'PharmA', status: 'in_transit', created_at: new Date().toISOString(), attempts: 0 }]);
  console.log({ data, error });
})();
