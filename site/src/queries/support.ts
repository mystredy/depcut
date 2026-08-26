"use client";

import { useMutation } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";

export type SupportTicket = {
  id: string;
  number: number;
  subject: string;
  message: string;
  status: "Open" | "Investigating" | "Resolved";
  response: string | null;
  createdAt: string;
  updatedAt: string;
  attachmentContentType: string | null;
};

export function useCreateSupportTicket() {
  return useMutation({
    mutationFn: (input: {
      subject: string;
      message: string;
      attachment?: { data: string; contentType: string };
    }) =>
      apiFetch<{ ticket: SupportTicket }>("/api/support-tickets", {
        body: JSON.stringify(input),
        method: "POST",
      }),
  });
}
