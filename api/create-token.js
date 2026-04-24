// api/create-token.js — Vercel Serverless Function
// Proxy payment token creation — no CORS issues (same origin)

export default async function handler(req, res) {
  // CORS headers (untuk jaga-jaga)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { uid, plan, price_id, order_id, amount } = req.body;

  if (!uid || !order_id || !amount) {
    return res.status(400).json({ error: "Field uid, order_id, amount diperlukan" });
  }

  if (order_id.length > 50) {
    return res.status(400).json({ error: `order_id terlalu panjang (${order_id.length} kar, max 50)` });
  }

  const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
  if (!MIDTRANS_SERVER_KEY) {
    return res.status(500).json({ error: "MIDTRANS_SERVER_KEY tidak dikonfigurasi" });
  }

  const planLabels = {
    scholar: "CekSINTA Scholar", sch: "CekSINTA Scholar",
    researcher: "CekSINTA Researcher", res: "CekSINTA Researcher",
    dosenpro: "CekSINTA Dosen Pro", dos: "CekSINTA Dosen Pro",
  };
  const periodLabels = {
    monthly: "Bulanan", mon: "Bulanan",
    semester: "Semester 6bln", sem: "Semester 6bln",
    yearly: "Tahunan 12bln", yea: "Tahunan 12bln",
  };

  const itemName = `${planLabels[plan] || "CekSINTA Pro"} ${periodLabels[price_id] || "Bulanan"}`.slice(0, 50);

  const snapPayload = {
    transaction_details: {
      order_id,
      gross_amount: parseInt(amount),
    },
    item_details: [{
      id: `${(plan || "res").slice(0, 5)}_${(price_id || "mon").slice(0, 3)}`,
      price: parseInt(amount),
      quantity: 1,
      name: itemName,
    }],
    customer_details: {
      first_name: "Pengguna",
      last_name: "CekSINTA",
    },
    callbacks: {
      finish: `https://ceksinta-landing.vercel.app/success.html?uid=${encodeURIComponent(uid)}&plan=${plan}&price_id=${price_id}&order_id=${encodeURIComponent(order_id)}&amount=${amount}`,
    },
  };

  const authStr = Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString("base64");

  const snapRes = await fetch("https://app.sandbox.midtrans.com/snap/v1/transactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${authStr}`,
      "Accept": "application/json",
    },
    body: JSON.stringify(snapPayload),
  });

  const snapData = await snapRes.json();

  if (!snapRes.ok || !snapData.token) {
    console.error("Midtrans error:", JSON.stringify(snapData));
    return res.status(500).json({ error: "Gagal buat token Midtrans", detail: snapData });
  }

  return res.status(200).json({
    snap_token: snapData.token,
    redirect_url: snapData.redirect_url,
    order_id,
  });
}
