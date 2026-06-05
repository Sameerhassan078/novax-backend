const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const BYBIT_API_KEY = process.env.BYBIT_API_KEY;
const BYBIT_SECRET = process.env.BYBIT_SECRET;
const BYBIT_BASE = "https://api.bybit.com";

// HMAC Signature
const generateSignature = (params, secret) => {
  const timestamp = Date.now().toString();
  const recvWindow = "5000";
  const queryString = Object.entries(params)
    .sort()
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const sigStr = timestamp + BYBIT_API_KEY + recvWindow + queryString;
  const sig = crypto
    .createHmac("sha256", secret)
    .update(sigStr)
    .digest("hex");

  return { timestamp, recvWindow, sig };
};

// Place Order
app.post("/api/order/place", async (req, res) => {
  try {
    const { symbol, side, qty, orderType } = req.body;

    const params = {
      category: "spot",
      symbol: symbol,
      side: side, // "Buy" or "Sell"
      orderType: orderType || "Market",
      qty: qty.toString(),
    };

    const { timestamp, recvWindow, sig } = generateSignature(params, BYBIT_SECRET);

    const response = await axios.post(
      `${BYBIT_BASE}/v5/order/create`,
      params,
      {
        headers: {
          "X-BAPI-API-KEY": BYBIT_API_KEY,
          "X-BAPI-TIMESTAMP": timestamp,
          "X-BAPI-RECV-WINDOW": recvWindow,
          "X-BAPI-SIGN": sig,
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get Order Status
app.get("/api/order/status/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { symbol } = req.query;

    const params = {
      category: "spot",
      symbol,
      orderId,
    };

    const { timestamp, recvWindow, sig } = generateSignature(params, BYBIT_SECRET);

    const response = await axios.get(
      `${BYBIT_BASE}/v5/order/realtime`,
      {
        params,
        headers: {
          "X-BAPI-API-KEY": BYBIT_API_KEY,
          "X-BAPI-TIMESTAMP": timestamp,
          "X-BAPI-RECV-WINDOW": recvWindow,
          "X-BAPI-SIGN": sig,
        },
      }
    );

    res.json(response.data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get Bybit Price
app.get("/api/price/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const response = await axios.get(
      `${BYBIT_BASE}/v5/market/tickers?category=spot&symbol=${symbol}`
    );
    res.json(response.data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get Orderbook
app.get("/api/orderbook/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const response = await axios.get(
      `${BYBIT_BASE}/v5/market/orderbook?category=spot&symbol=${symbol}&limit=20`
    );
    res.json(response.data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`NovaX Backend running on port ${PORT}`));