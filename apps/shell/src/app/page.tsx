import { redirect } from "next/navigation";

/**
 * Authenticated entry; middleware sends anonymous visitors to /login. The role is only known in the
 * browser, so `/start` picks the landing page (Omar 2026-11-09: «أعمالي» for whoever holds it —
 * this used to redirect everyone to /dashboard).
 */
export default function Home() {
  redirect("/start");
}
