const express = require("express");
const cors = require("cors");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 3000;

const USER_SECRET_KEY = process.env.TOYYIBPAY_SECRET || "h2k0uyxt-s85z-jwea-bcd2-87fe1m3n6fpj";
const CATEGORY_CODE = process.env.TOYYIBPAY_CATEGORY || "n9i4sdhf";
const TOYYIBPAY_URL = "https://toyyibpay.com";
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const pendingBills = new Map();

app.get("/api/status", (req, res) => {
  res.json({ status: "ok", service: "HAFA Homestay Payment API" });
});

app.post("/api/create-bill", async (req, res) => {
  try {
    const { name, email, phone, amount, checkIn, checkOut, notes } = req.body;
    if (!name || !amount) return res.status(400).json({ error: "Nama dan jumlah diperlukan" });

    const billAmount = parseInt(amount) * 100;
    const refNo = "HAFA-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();

    const billData = {
      userSecretKey: USER_SECRET_KEY,
      categoryCode: CATEGORY_CODE,
      billName: "HAFA Homestay - Tempahan",
      billDescription: `Tempahan ${name}${notes ? " - " + notes : ""}`,
      billAmount: billAmount,
      billReturnUrl: `${PUBLIC_URL}/api/payment-return?ref=${refNo}`,
      billCallbackUrl: `${PUBLIC_URL}/api/payment-callback`,
      billExternalReferenceNo: refNo,
      billTo: name,
      billEmail: email || "",
      billPhone: phone || "",
      billPaymentChannel: "0",
      billDisplayMerchant: 1,
      billPriceSetting: 1,
      billPayorInfo: 1,
      billContentEmail: `Terima kasih ${name}! Tempahan HAFA Homestay anda telah diterima. Rujukan: ${refNo}`,
      billChargeToCustomer: 1,
    };

    const response = await axios.post(`${TOYYIBPAY_URL}/index.php/api/createBill`, new URLSearchParams(billData));
    const result = response.data;

    if (result && result[0] && result[0].BillCode) {
      const billCode = result[0].BillCode;
      pendingBills.set(refNo, {
        billCode, name, email, phone, amount: parseInt(amount),
        checkIn, checkOut, notes, status: "pending",
        createdAt: new Date().toISOString()
      });
      res.json({ success: true, refNo, billCode, paymentUrl: `${TOYYIBPAY_URL}/${billCode}` });
    } else {
      res.status(500).json({ error: "Gagal cipta bil", details: result });
    }
  } catch (err) {
    console.error("Create bill error:", err.response?.data || err.message);
    res.status(500).json({ error: "Ralat server", details: err.message });
  }
});

app.get("/api/payment-return", (req, res) => {
  const ref = req.query.ref;
  const bill = pendingBills.get(ref);
  if (bill) bill.status = req.query.status === "1" ? "paid" : "failed";
  res.redirect(`/payment-result.html?ref=${ref}&status=${req.query.status || "pending"}`);
});

app.post("/api/payment-callback", (req, res) => {
  const { refno, status, billcode, amount } = req.body;
  const bill = pendingBills.get(refno);
  if (bill && bill.billCode === billcode) {
    bill.status = status === "1" ? "paid" : "failed";
    bill.paidAmount = amount;
  }
  res.send("OK");
});

app.get("/api/bill-status/:ref", (req, res) => {
  const bill = pendingBills.get(req.params.ref);
  if (!bill) return res.status(404).json({ error: "Bil tidak dijumpai" });
  res.json(bill);
});

app.get("/*", (req, res) => {
  res.sendFile("index.html", { root: "public" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🏡 HAFA Homestay running on http://0.0.0.0:${PORT}`);
});
