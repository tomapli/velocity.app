import { notFound } from "next/navigation";

import { IgPostDetail } from "@/components/ig/ig-post-detail";
import { PageShell } from "@/components/ui/page-shell";
import { IG_POST_ID_PATTERN, IG_USERNAME_PATTERN } from "@/lib/ig/constants";
import { getIgPostForUsername, getIgProfileByUsername } from "@/lib/ig/queries";
import { createClient } from "@/lib/supabase/server";

interface IgPostPageProps {
  params: Promise<{ username: string; postId: string }>;
}

export default async function IgPostPage({ params }: IgPostPageProps) {
  const { username: rawUsername, postId } = await params;
  const username = rawUsername.toLowerCase();

  if (!IG_USERNAME_PATTERN.test(username) || !IG_POST_ID_PATTERN.test(postId)) {
    notFound();
  }

  const supabase = await createClient();
  const [post, profile] = await Promise.all([
    getIgPostForUsername(supabase, username, postId),
    getIgProfileByUsername(supabase, username),
  ]);

  if (!post) {
    notFound();
  }

  return (
    <PageShell size="full">
        <IgPostDetail username={username} profile={profile} post={post} />
    </PageShell>
  );
}
