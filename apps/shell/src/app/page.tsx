import { redirect } from "next/navigation";

/** Authenticated entry; middleware sends anonymous visitors to /login. */
export default function Home() {
  redirect("/dashboard");
}
