"use client";

import { useParams } from "next/navigation";

import { PostEditor } from "@/app/admin/blog/PostEditor";

export default function EditBlogPostPage() {
  const { id } = useParams<{ id: string }>();
  return <PostEditor postId={id} />;
}
