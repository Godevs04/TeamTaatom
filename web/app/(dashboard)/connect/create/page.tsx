"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { connectCreatePage } from "@/lib/connect-api";
import { getFriendlyErrorMessage } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";

export default function ConnectCreatePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<"public" | "private">("public");
  const [bio, setBio] = React.useState("");
  const [featWebsite, setFeatWebsite] = React.useState(true);
  const [featSubscription, setFeatSubscription] = React.useState(false);
  const [featGroupChat, setFeatGroupChat] = React.useState(false);
  const [subscriptionPrice, setSubscriptionPrice] = React.useState("");
  const [profileFile, setProfileFile] = React.useState<File | null>(null);
  const [bannerFile, setBannerFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Sign in required.");
      return;
    }
    if (name.trim().length < 3) {
      toast.error("Name must be at least 3 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("type", type);
      if (bio.trim()) fd.append("bio", bio.trim());
      fd.append(
        "features",
        JSON.stringify({
          website: featWebsite,
          groupChat: featGroupChat,
          subscription: featSubscription,
        })
      );
      if (featSubscription && subscriptionPrice.trim()) {
        fd.append("subscriptionPrice", subscriptionPrice.trim());
      }
      if (profileFile) fd.append("profileImage", profileFile);
      if (bannerFile) fd.append("bannerImage", bannerFile);

      const page = await connectCreatePage(fd);
      toast.success("Connect page created.");
      router.replace(`/connect/page/${page._id}`);
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-24 lg:pb-10">
      <Link href="/connect" className="text-sm font-medium text-primary hover:underline">
        ← Back to Connect
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Create Connect page</CardTitle>
          <CardDescription>
            Share a public page with optional website blocks and subscriptions (pricing may require admin approval).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={50} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Visibility</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "public" | "private")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Bio (optional)</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-zinc-700">
              <p className="text-sm font-medium">Features</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={featWebsite} onChange={(e) => setFeatWebsite(e.target.checked)} />
                Website content
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={featSubscription}
                  onChange={(e) => setFeatSubscription(e.target.checked)}
                />
                Paid subscriptions
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={featGroupChat} onChange={(e) => setFeatGroupChat(e.target.checked)} />
                Group chat
              </label>
            </div>
            {featSubscription && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Monthly price (minor units / cents per backend rules)</label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g. 499"
                  value={subscriptionPrice}
                  onChange={(e) => setSubscriptionPrice(e.target.value)}
                />
                <p className="text-xs text-slate-500">
                  Final currency and validation follow server rules; admins may need to approve pricing.
                </p>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium">Profile image</label>
              <Input type="file" accept="image/*" onChange={(e) => setProfileFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Banner image</label>
              <Input type="file" accept="image/*" onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)} />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Creating…" : "Create page"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
