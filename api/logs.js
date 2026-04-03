export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  if (req.method === "OPTIONS") return res.status(200).end();

  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxxBXdrbzWWIXpV1ZuY4pwCdXNUYcej5Sag7s90K7uyoKiSXH9cqL9kC6o1YMOg9z_X6g/exec";

  try {
    if (req.method === "GET") {
      const response = await fetch(`${APPS_SCRIPT_URL}?action=get`, { redirect: "follow" });
      const data = await response.json();
      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const response = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return res.status(200).json(data);
    }
  } catch (err) {
    return res.status(500).json({ error: err.toString() });
  }
}
