"use client";

import { VideoGenerator } from "@/cut/components/VideoGenerator";

// Standalone version of the editor Video tab's generate panel — same
// composer the dashboard embeds, see VideoGenerator.tsx.
export default function TextToVideoPage() {
  return (
    <div className="w-full space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Text to Video</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe a clip and DepCut&apos;s AI model will render it.
        </p>
      </div>
      <VideoGenerator promptPosition="bottom" />
    </div>
  );
}
