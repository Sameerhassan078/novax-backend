// Bybit ki jagah Binance public API use karo price ke liye
app.get("/api/price/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const response = await axios.get(
      `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`
    );
    res.json({ 
      result: { 
        list: [{ lastPrice: response.data.price }] 
      } 
    });
  } catch(e) {
    // Fallback to Bybit
    try {
      const r = await axios.get(
        `https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`
      );
      res.json(r.data);
    } catch(err) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Orderbook bhi Binance se
app.get("/api/orderbook/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const response = await axios.get(
      `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=20`
    );
    const data = response.data;
    res.json({
      result: {
        a: data.asks,
        b: data.bids,
      }
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});