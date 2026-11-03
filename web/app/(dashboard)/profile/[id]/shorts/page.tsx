import { redirect } from "next/navigation";

/** Shorts now live in the profile's Shorts tab (mobile parity). */
export default function ProfileShortsRedirect({ params }: { params: { id: string } }) {
  redirect(`/profile/${encodeURIComponent(params.id)}?tab=shorts`);
}
