const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const axios = require("axios");
require("dotenv").config();

const app = express(); // ✅ MUST BE FIRST

app.use(cors());
app.use(express.json());

// ENV CHECK
const BYBIT_API_KEY = process.env.BYBIT_API_KEY;
const BYBIT_SECRET = process.env.BYBIT_SECRET;
const BYBIT_BASE = "https://api.bybit.com";

if (!BYBIT_API_KEY || !BYBIT_SECRET) {
  console.log("❌ Missing API keys in .env");
}

app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

// =======================
// SIGNATURE FUNCTION
// =======================
const generateSignature = (params) => {
  const timestamp = Date.now().toString();
  const recvWindow = "5000";

  const queryString = Object.entries(params)
    .sort()
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const sigStr = timestamp + BYBIT_API_KEY + recvWindow + queryString;

  const signature = crypto
    .createHmac("sha256", BYBIT_SECRET)
    .update(sigStr)
    .digest("hex");

  return { timestamp, recvWindow, signature };
};

// =======================
// PLACE ORDER
// =======================
app.post("/api/order/place", async (req, res) => {
  try {
    const { symbol, side, qty, orderType } = req.body;

    if (!symbol || !side || !qty) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const params = {
      category: "spot",
      symbol,
      side,
      orderType: orderType || "Market",
      qty: qty.toString(),
    };

    const { timestamp, recvWindow, signature } = generateSignature(params);

    const response = await axios.post(
      `${BYBIT_BASE}/v5/order/create`,
      params,
      {
        headers: {
          "X-BAPI-API-KEY": BYBIT_API_KEY,
          "X-BAPI-TIMESTAMP": timestamp,
          "X-BAPI-RECV-WINDOW": recvWindow,
          "X-BAPI-SIGN": signature,
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (e) {
    console.error(e.response?.data || e.message);
    res.status(500).json({ error: e.message });
  }
});

// =======================
// ORDER STATUS
// =======================
app.get("/api/order/status/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { symbol } = req.query;

    if (!symbol) {
      return res.status(400).json({ error: "symbol is required" });
    }

    const params = {
      category: "spot",
      symbol,
      orderId,
    };

    const { timestamp, recvWindow, signature } = generateSignature(params);

    const response = await axios.get(
      `${BYBIT_BASE}/v5/order/realtime`,
      {
        params,
        headers: {
          "X-BAPI-API-KEY": BYBIT_API_KEY,
          "X-BAPI-TIMESTAMP": timestamp,
          "X-BAPI-RECV-WINDOW": recvWindow,
          "X-BAPI-SIGN": signature,
        },
      }
    );

    res.json(response.data);
  } catch (e) {
    console.error(e.response?.data || e.message);
    res.status(500).json({ error: e.message });
  }
});

// =======================
// PRICE (BINANCE)
// =======================
app.get("/api/price/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    const response = await axios.get(
      `https://api.bybit.com/v5/market/tickers`,
      {
        params: {
          category: "spot",
          symbol: symbol
        },
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json"
        }
      }
    );

    res.json(response.data);
  } catch (e) {
    res.status(500).json({
      error: e.response?.data || e.message
    });
  }
});


// =======================
// ORDERBOOK (BINANCE)
// =======================
app.get("/api/orderbook/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    const response = await axios.get(
      `https://api.bybit.com/v5/market/orderbook?category=spot&symbol=${symbol}`
    );
    const response = await axios.get(
  `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`
);

    const data = response.data;

    res.json({
      bids: data.result?.b || [],
      asks: data.result?.a || [],
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =======================
// START SERVER (IMPORTANT FOR RENDER)
// =======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});