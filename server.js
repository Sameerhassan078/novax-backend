const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const BYBIT_KEY = process.env.BYBIT_API_KEY;
const BYBIT_SECRET = process.env.BYBIT_SECRET;
const BYBIT_BASE = "https://api.bybit.com";

// ✅ Bybit Signature Generator
const signBybit = (params) => {
  const timestamp = Date.now().toString();
  const recvWindow = "5000";
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join("&");
  const sigStr = `${timestamp}${BYBIT_KEY}${recvWindow}${sortedParams}`;
  const signature = crypto
    .createHmac("sha256", BYBIT_SECRET)
    .update(sigStr)
    .digest("hex");
  return { timestamp, recvWindow, signature };
};

// ✅ Price from Binance (Public - No key needed)
app.get("/api/price/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    const response = await axios.get(
      `https://data-api.binance.vision/api/v3/ticker/price?symbol=${symbol}`
    );

    res.json({
      symbol: response.data.symbol,
      price: response.data.price
    });

  } catch (e) {
    res.status(500).json({
      error: e.message
    });
  }
});

// ✅ Orderbook from Binance (Public - No key needed)
app.get("/api/orderbook/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    const response = await axios.get(
      `https://data-api.binance.vision/api/v3/depth?symbol=${symbol}&limit=20`
    );

    const data = response.data;

    res.json({
      bids: data.bids.map(b => ({
        price: b[0],
        qty: b[1]
      })),
      asks: data.asks.map(a => ({
        price: a[0],
        qty: a[1]
      }))
    });

  } catch (e) {
    res.status(500).json({
      error: e.message
    });
  }
});

// ✅ Place Order on Bybit (Private - Needs API key)
app.post("/api/order/place", async (req, res) => {
  try {
    const { symbol, side, qty } = req.body;

    if (!BYBIT_KEY || !BYBIT_SECRET) {
      return res.status(400).json({
        success: false,
        error: "Bybit API keys not configured!"
      });
    }

    const params = {
      category: "spot",
      symbol: symbol,
      side: side, // "Buy" or "Sell"
      orderType: "Market",
      qty: qty.toString(),
    };

    const { timestamp, recvWindow, signature } = signBybit(params);

    const response = await axios.post(
      `${BYBIT_BASE}/v5/order/create`,
      params,
      {
        headers: {
          "X-BAPI-API-KEY": BYBIT_KEY,
          "X-BAPI-TIMESTAMP": timestamp,
          "X-BAPI-RECV-WINDOW": recvWindow,
          "X-BAPI-SIGN": signature,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.retCode === 0) {
      const orderId = response.data.result.orderId;

      // Wait 1.5 sec for order to fill
      await new Promise(r => setTimeout(r, 1500));

      // Check fill status
      const fillParams = {
        category: "spot",
        symbol,
        orderId,
      };
      const { timestamp: t2, recvWindow: rw2, signature: s2 } = signBybit(fillParams);

      const fillRes = await axios.get(
        `${BYBIT_BASE}/v5/order/history`,
        {
          params: fillParams,
          headers: {
            "X-BAPI-API-KEY": BYBIT_KEY,
            "X-BAPI-TIMESTAMP": t2,
            "X-BAPI-RECV-WINDOW": rw2,
            "X-BAPI-SIGN": s2,
          },
        }
      );

      const orderInfo = fillRes.data?.result?.list?.[0];

      res.json({
        success: true,
        orderId,
        status: orderInfo?.orderStatus || "Filled",
        fillPrice: orderInfo?.avgPrice || orderInfo?.price,
        fillQty: orderInfo?.cumExecQty || qty,
        fee: orderInfo?.cumExecFee || "0",
        exchange: "Bybit",
        rawResponse: response.data,
      });
    } else {
      res.json({
        success: false,
        error: response.data.retMsg,
        code: response.data.retCode,
      });
    }
  } catch(e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// ✅ Check Order Status
app.get("/api/order/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { symbol } = req.query;

    const params = {
      category: "spot",
      symbol,
      orderId,
    };
    const { timestamp, recvWindow, signature } = signBybit(params);

    const r = await axios.get(
      `${BYBIT_BASE}/v5/order/history`,
      {
        params,
        headers: {
          "X-BAPI-API-KEY": BYBIT_KEY,
          "X-BAPI-TIMESTAMP": timestamp,
          "X-BAPI-RECV-WINDOW": recvWindow,
          "X-BAPI-SIGN": signature,
        },
      }
    );

    const order = r.data?.result?.list?.[0];
    res.json({
      success: true,
      orderId,
      status: order?.orderStatus,
      fillPrice: order?.avgPrice,
      fillQty: order?.cumExecQty,
      fee: order?.cumExecFee,
    });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ✅ Health Check
app.get("/", (req, res) => {
  res.json({
    status: "NovaX Backend Running ✅",
    binance: "Connected (Public API)",
    bybit: BYBIT_KEY ? "Connected (Private API)" : "⚠️ API Key Missing",
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ NovaX Backend running on port ${PORT}`);
  console.log(`Bybit API: ${BYBIT_KEY ? "Configured ✅" : "Missing ⚠️"}`);
});