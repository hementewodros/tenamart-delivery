require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { ethers } = require('ethers');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(bodyParser.json());

// Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Ethereum setup
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  [
    "function recordDelivery(bytes32 recordHash, uint256 timestamp, string pharmacist) external",
    "event DeliveryRecorded(bytes32 indexed recordHash, uint256 timestamp, address indexed recorder, string pharmacist)"
  ],
  wallet
);

// Pollers map
const pollers = {};
const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS || "60");

// 🏥 Pharmacist GET endpoint
app.get('/api/pharm/delivery', async (req, res) => {
  const { deliveryId, callback, pharmacist } = req.query;
  if (!deliveryId || !callback) return res.status(400).json({ error: "deliveryId & callback required" });

  const record = {
    id: deliveryId,
    callback,
    pharmacist: pharmacist || null,
    status: 'in_transit',
    created_at: new Date().toISOString(),
    attempts: 0
  };

  const { error } = await supabase.from('deliveries').upsert([record], { onConflict: 'id' });
  if (error) return res.status(500).json({ error: "DB error" });

  if (!pollers[deliveryId]) startPoller(deliveryId);

  res.json({ ok: true, id: deliveryId });
});

// 🔄 Poller function
function startPoller(deliveryId) {
  console.log("Starting poller for", deliveryId);
  let attempts = 0;

  const intervalId = setInterval(async () => {
    attempts++;
    const { data } = await supabase.from('deliveries').select('*').eq('id', deliveryId).single();
    if (!data) { clearInterval(intervalId); return; }

    try {
      const resp = await axios.get(data.callback, { timeout: 5000 }).catch(() => null);
      const payload = resp?.data;

      await supabase.from('deliveries').update({ attempts }).eq('id', deliveryId);

      if (payload?.status === 'delivered' || payload?.status === 'confirmed') {
        const final = {
          status: 'delivered',
          recipient_name: payload.recipientName || payload.name || null,
          recipient_signature: payload.signature || null,
          delivered_at: payload.timestamp || new Date().toISOString(),
          pharmacist_reply: payload.pharmacist || data.pharmacist
        };
        await supabase.from('deliveries').update(final).eq('id', deliveryId);

        // Compute hash and record on-chain
        const recordToHash = {
          id: deliveryId,
          pharmacist: data.pharmacist,
          recipient: final.recipient_name,
          delivered_at: final.delivered_at,
          pharmacist_reply: final.pharmacist_reply
        };
        const recordJson = JSON.stringify(recordToHash);
        const recordHash = ethers.keccak256(ethers.toUtf8Bytes(recordJson));
        const timestamp = Math.floor(Date.now() / 1000);

        try {
          const tx = await contract.recordDelivery(recordHash, timestamp, data.pharmacist || "");
          await tx.wait();
          await supabase.from('deliveries').update({
            onchain_hash: recordHash,
            onchain_txhash: tx.hash,
            status: 'onchain_recorded'
          }).eq('id', deliveryId);
        } catch (err) {
          console.error("On-chain error:", err);
          await supabase.from('deliveries').update({
            onchain_error: String(err),
            status: 'delivered_onchain_failed'
          }).eq('id', deliveryId);
        }

        clearInterval(intervalId);
      }

      if (attempts >= MAX_ATTEMPTS) {
        await supabase.from('deliveries').update({ status: 'timeout' }).eq('id', deliveryId);
        clearInterval(intervalId);
      }
    } catch (err) {
      console.error("Poller error:", err);
      if (attempts >= MAX_ATTEMPTS) clearInterval(intervalId);
    }
  }, 60 * 1000);

  pollers[deliveryId] = { intervalId, attempts: 0 };
}

// ✅ Recipient confirmation endpoint
app.post('/api/confirm', async (req, res) => {
  const { deliveryId, name, signature } = req.body;
  if (!deliveryId || !name) return res.status(400).json({ error: "deliveryId & name required" });

  const { data, error } = await supabase.from('deliveries').select('*').eq('id', deliveryId).single();
  if (error || !data) return res.status(404).json({ error: "Delivery not found" });

  const delivered_at = new Date().toISOString();

  await supabase.from('deliveries').update({
    status: 'delivered',
    recipient_name: name,
    recipient_signature: signature || null,
    delivered_at
  }).eq('id', deliveryId);

  const recordToHash = {
    id: deliveryId,
    pharmacist: data.pharmacist,
    recipient: name,
    delivered_at
  };
  const recordJson = JSON.stringify(recordToHash);
  const recordHash = ethers.keccak256(ethers.toUtf8Bytes(recordJson));
  const timestamp = Math.floor(Date.now() / 1000);

  try {
    const tx = await contract.recordDelivery(recordHash, timestamp, data.pharmacist || "");
    await tx.wait();
    await supabase.from('deliveries').update({
      onchain_hash: recordHash,
      onchain_txhash: tx.hash,
      status: 'onchain_recorded'
    }).eq('id', deliveryId);

    res.json({ ok: true, onchain_tx: tx.hash, recordHash });
  } catch (err) {
    console.error("On-chain error:", err);
    await supabase.from('deliveries').update({ onchain_error: String(err) }).eq('id', deliveryId);
    res.status(500).json({ error: "On-chain error", details: String(err) });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
