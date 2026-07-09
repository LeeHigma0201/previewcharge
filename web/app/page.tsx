import { redirect } from "next/navigation";

// Site is single-purpose: today's race card. Root redirects to /bets.
export default function Home() {
  redirect("/bets");
}
