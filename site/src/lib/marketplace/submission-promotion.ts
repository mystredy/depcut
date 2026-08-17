import { prisma } from "@/lib/prisma";
import { notifyTelegram } from "@/lib/telegram/notify";

// video and thumbnail are always required; verification only for Pro
// submissions.
function requiredAssetTypes(extension: string): string[] {
  return extension === "pro" ? ["video", "thumbnail", "verification"] : ["video", "thumbnail"];
}

// The server-authoritative promotion check — called after any asset reaches
// "complete", and right after Submit fires in case every upload had already
// finished by then. Moves a submission out of "submitting" or "failed" (a
// retried asset can re-promote straight to "submitted" without a second
// Submit click) into "submitted" once every required asset is present. The
// browser only ever reports "this asset's bytes are in R2 now" — it never
// decides the submission itself is done.
export async function tryPromoteSubmission(submissionId: string): Promise<void> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { assets: true, user: { select: { displayName: true, email: true, name: true } } },
  });
  if (!submission) return;
  // Only a submission the creator actually asked to submit, and that isn't
  // already resolved, is eligible.
  if (!submission.submitRequestedAt) return;
  if (submission.status !== "submitting" && submission.status !== "failed") return;

  const required = requiredAssetTypes(submission.extension);
  const complete = required.every((type) =>
    submission.assets.some((a) => a.type === type && a.status === "complete"),
  );
  if (!complete) return;

  await prisma.$transaction(async (tx) => {
    // Pro submissions carry a publishing package — materialize (or update)
    // the real Upload row from the draft's scratch package* fields now that
    // everything's confirmed. Mirrors what the old one-shot create used to
    // build eagerly; this just does it at promotion time instead.
    let publishingId = submission.publishingid;
    if (submission.extension === "pro" && submission.packageTitle) {
      const verification = submission.assets.find((a) => a.type === "verification");
      if (publishingId) {
        await tx.upload.update({
          data: {
            description: submission.packageDescription,
            mediaFile: verification?.fileName,
            mediaKey: verification?.storageKey,
            tags: submission.packageTags,
            title: submission.packageTitle,
          },
          where: { id: publishingId },
        });
      } else {
        const upload = await tx.upload.create({
          data: {
            createdById: submission.userId,
            description: submission.packageDescription,
            mediaFile: verification?.fileName,
            mediaKey: verification?.storageKey,
            submissionId: submission.id,
            tags: submission.packageTags,
            title: submission.packageTitle,
          },
        });
        publishingId = upload.id;
      }
    }

    await tx.submission.update({
      data: {
        // Inspire-mode submissions have no linked Task to inherit maxRates
        // from, so they default to 10.
        maxRates: submission.maxRates ?? 10,
        publishingid: publishingId,
        reviewStatus: "Pending",
        status: "submitted",
        submittedAt: new Date(),
      },
      where: { id: submission.id },
    });
  });

  const submitterName = submission.user.displayName || submission.user.name || submission.user.email;
  const now = new Date();
  const siteOrigin = (process.env.BETTER_AUTH_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");

  const lines = [
    "🆕 New Submission Pending Review",
    "",
    `👤 User: ${submitterName} | ${submission.userId}`,
    `🎬 Title: ${submission.title ?? "Untitled"}`,
    `🎯 Mode: ${submission.taskId ? "Task" : "Inspire"}`,
    `🏷️ Type: ${submission.extension}`,
  ];
  if (submission.inspireUrl) {
    lines.push(`🔗 Link: click here (${submission.inspireUrl})`);
  }
  if (submission.voiceScript) {
    lines.push(`📜 Script: ${submission.voiceScript}`);
  }
  lines.push(
    "",
    `📅 Date: ${now.toISOString().slice(0, 10)}`,
    `🕒 Time: ${now.toISOString().slice(11, 19)}`,
    "",
    "Status: ⏳ Pending",
    "",
    `👉 Review it: ${siteOrigin}/admin/submissions?id=${submission.id}`,
  );

  await notifyTelegram("submission", lines.join("\n"));
}

// One asset's upload didn't make it — client-reported failure, or /complete
// discovering the bytes never actually arrived. Fails the asset and, if the
// submission had already asked to submit, fails the submission too: it
// never silently sits at "submitting" (or worse, "submitted") missing media.
export async function failSubmissionAsset(
  submissionId: string,
  type: string,
  error: string,
): Promise<void> {
  await prisma.submissionAsset.updateMany({
    data: { error, status: "failed" },
    where: { submissionId, type },
  });
  await prisma.submission.updateMany({
    data: { status: "failed" },
    where: { id: submissionId, status: "submitting" },
  });
}
