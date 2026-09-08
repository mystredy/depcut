"use client";

import { useMutation } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";

export type SupportMessage = {
  id: string;
  authorId: string;
  message: string;
  createdAt: string;
  attachments: { id: string; contentType: string }[];
};

export type SupportTicket = {
  id: string;
  number: number;
  subject: string;
  status: "Open" | "Investigating" | "Answered" | "Closed";
  priority: "Low" | "Medium" | "High";
  lastReplyAt: string | null;
  createdAt: string;
  messages: SupportMessage[];
};

export function useCreateSupportTicket() {
  return useMutation({
    mutationFn: (input: {
      subject: string;
      message: string;
      attachments?: { data: string; contentType: string }[];
    }) =>
      apiFetch<{ ticket: SupportTicket }>("/api/support-tickets", {
        body: JSON.stringify(input),
        method: "POST",
      }),
  });
}
