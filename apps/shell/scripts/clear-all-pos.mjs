/**
 * Wipes all operational system data from the API (dev/maintenance).
 * Usage: node apps/shell/scripts/clear-all-pos.mjs
 * Env: API_URL (default http://localhost:5160), ADMIN_USERNAME (default sliman)
 */
const API = (process.env.API_URL ?? "http://localhost:5160").replace(/\/$/, "");
const USERNAME = process.env.ADMIN_USERNAME ?? "sliman";

async function main() {
  const loginRes = await fetch(`${API}/api/auth/login-username`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME }),
  });
  if (!loginRes.ok) {
    console.error("Login failed:", loginRes.status, await loginRes.text());
    process.exit(1);
  }
  const { token } = await loginRes.json();
  if (!token) {
    console.error("No token in login response");
    process.exit(1);
  }

  const headers = { Authorization: `Bearer ${token}` };
  const resetRes = await fetch(`${API}/api/system/data`, {
    method: "DELETE",
    headers,
  });
  if (!resetRes.ok) {
    console.error("Reset failed:", resetRes.status, await resetRes.text());
    process.exit(1);
  }
  const result = await resetRes.json();
  console.log("System reset complete:", result);
  console.log(
    "In the browser: System Tools → «مسح كل بيانات النظام» to clear eval* localStorage.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
