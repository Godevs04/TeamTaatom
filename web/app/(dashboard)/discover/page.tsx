import { redirect } from "next/navigation";

export default function DiscoverPage() {
  // W-11: dedicated discover route that maps to existing search experience.
  redirect("/search");
}
