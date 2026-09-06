"use client";

import { useState } from "react";
import { Loader2, MoreVertical, Search, ShieldCheck, ShieldOff } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserAvatar } from "@/cut/components/UserAvatar";
import { useSiteDateFormat } from "@/lib/siteDateFormat";
import { useAdminUsers, useSetSuperUser } from "@/queries/admin";

// admin/settings/general's Date Format decides the fallback once an activity
// timestamp is old enough to stop reading as a relative "N days ago".
function timeAgo(iso: string, formatDate: (value: string) => string) {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(iso);
}

export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const users = useAdminUsers(query);
  const setSuperUser = useSetSuperUser();
  const { formatDate } = useSiteDateFormat();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">Search and browse every account.</p>
      </div>

      <label className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-input px-2.5 py-1.5 focus-within:border-ring">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      <div className="rounded-2xl border bg-card">
        {users.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : users.isError ? (
          <p className="p-6 text-sm text-destructive">Couldn&apos;t load users. Try again.</p>
        ) : (
          <Table className="min-w-[420px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">User</TableHead>
                <TableHead className="w-28">Active</TableHead>
                <TableHead className="w-24">Joined</TableHead>
                <TableHead className="w-10 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data?.users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="overflow-hidden">
                    <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
                      <UserAvatar
                        className="size-8 shrink-0"
                        name={u.displayName || u.name}
                        image={u.image}
                      />
                      <div className="min-w-0 overflow-hidden">
                        <p className="truncate text-sm font-medium">{u.displayName || u.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.lastActiveAt ? timeAgo(u.lastActiveAt, formatDate) : "Never"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(u.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        title="User actions"
                        aria-label="User actions"
                        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <MoreVertical className="size-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={setSuperUser.isPending}
                          onClick={() =>
                            setSuperUser.mutate({ superUser: !u.superUser, userId: u.id })
                          }
                        >
                          {setSuperUser.isPending ? (
                            <Loader2 className="animate-spin" />
                          ) : u.superUser ? (
                            <ShieldOff />
                          ) : (
                            <ShieldCheck />
                          )}
                          {u.superUser ? "Remove super user" : "Make super user"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {users.data?.users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={100} className="py-8 text-center text-sm text-muted-foreground">
                    No users match &quot;{query}&quot;.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
