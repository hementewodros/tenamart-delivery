
# 🏥 TenaMart Delivery Registry

This project demonstrates a **blockchain-backed medicine delivery tracking system**.  
It combines:

- **Solidity smart contract** (`contracts/DeliveryRegistry.sol`) to record deliveries on-chain  
- **Node.js backend** (`backend/index.js`) to handle pharmacist and recipient confirmations  
- **Postman test collection** for easy testing without coding  

---

## 🚀 Features

- Pharmacist marks when a package is handed to the rider (`/api/pharm/delivery`)  
- Recipient confirms delivery (`/api/confirm`)  
- Delivery details are stored in a database (Supabase)  
- A cryptographic hash of the record is written on-chain (Sepolia testnet)  
- Postman collection provided for quick testing  

---

## ⚙️ Setup

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USER/tenamart-delivery.git
cd tenamart-delivery
````

### 2. Install dependencies

```bash
# Install at project root if using contracts
npm install

# Install backend dependencies
cd backend
npm install
```

### 3. Environment variables

We use a `.env` file to keep secrets **out of GitHub**.
An example is provided:

```bash
cp .env.example .env
```

Edit `.env` and fill with **testnet values only**:

```env
# Blockchain
ALCHEMY_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
DEPLOYER_PRIVATE_KEY=0xYOUR_TEST_PRIVATE_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY
CONTRACT_ADDRESS=0xYourDeployedContractAddress

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=YOUR_SUPABASE_KEY

# Server
PORT=3000
MAX_ATTEMPTS=60
```

⚠️ **Never commit `.env`** — it’s ignored by `.gitignore`.
Use only test accounts and test API keys.

### 4. Run backend server

```bash
cd backend
node index.js
```

By default it runs on:
👉 [http://localhost:3000](http://localhost:3000)

---
1. Open Postman.
2. Go to **File → Import**.
3. Import `TenaMart.postman_collection.json` (included in repo).

---

### Quick usage notes

* Import that JSON into Postman: File → Import → choose the JSON file or paste raw text.
* Create a Postman Environment (or edit the collection variables) and set:

  * `RPC_URL` (e.g. your node or provider RPC)
  * `CONTRACT_ADDRESS` (the verified contract address)
  * `ETHERSCAN_API_KEY` (if you want ABI via Etherscan)
  * `WALLET_ADDRESS` (for `balanceOf`)
  * `TX_HASH` (for receipt)
* Run "Get Contract ABI" to fetch ABI text — Postman will show the `result` field; you can copy/paste the ABI into a file or use it in scripts.
* The `balanceOf` request uses a pre-request script to create the `data` hex payload — no manual encoding needed.

### Step 2. Create environment

1. In Postman, click **Environments → Add Environment**.
2. Add these variables:

| Variable   | Initial value           | Example                                        |
| ---------- | ----------------------- | ---------------------------------------------- |
| baseUrl    | `http://localhost:3000` | [http://localhost:3000](http://localhost:3000) |
| deliveryId | `DEL123`                | DEL123                                         |

Save the environment and select it (top right dropdown).

### Step 3. Run requests

#### 1️⃣ Pharmacist starts delivery

* Select request: **Pharmacist Delivery (GET)**
* URL (auto-filled by Postman):

  ```
  {{baseUrl}}/api/pharm/delivery?deliveryId={{deliveryId}}&callback={{baseUrl}}/api/confirm&pharmacist=PharmA
  ```
* Click **Send**.
* Expected response:

  ```json
  { "ok": true }
  ```

#### 2️⃣ Recipient confirms delivery

* Select request: **Recipient Confirm (POST)**
* Body (JSON):

  ```json
  {
    "deliveryId": "{{deliveryId}}",
    "name": "Amanuel",
    "signature": "sample-signature"
  }
  ```
* Click **Send**.
* Expected response (with on-chain hash + tx):

  ```json
  {
    "ok": true,
    "onchain_tx": "0x...",
    "recordHash": "0x..."
  }
  ```

#### 3️⃣ Verify in database

Check your Supabase table `deliveries`. You should see:

* `status = onchain_recorded`
* `recipient_name` = the name used in confirm step
* `onchain_hash` and `onchain_txhash` populated

---

## 🔒 Security Checklist

* Repo contains `.env.example` (safe), not `.env`.
* **Never push private keys** to GitHub.
* Use **Sepolia test accounts only** (no real funds).
* GitHub repo can be private during testing.
* If secrets are ever exposed, rotate immediately.

---

## 📂 Project Structure

```
tenamart-delivery/
│
├── contracts/               # Solidity contracts
│   └── DeliveryRegistry.sol
│
├── backend/                 # Node.js backend
│   ├── index.js
│   └── package.json
│
├── TenaMart.postman_collection.json
│
├── .env.example             # Example env file
├── README.md                # This guide
└── .gitignore               # Prevents secrets from being pushed
```

---

## ✅ Summary

With this setup, anyone (including non-devs) can:

1. Start the backend locally
2. Use Postman collection to simulate pharmacist and recipient flow
3. See delivery confirmation stored **both in database and blockchain**


