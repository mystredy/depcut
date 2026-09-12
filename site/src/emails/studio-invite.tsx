import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "react-email";

// Sent by src/lib/email/send-studio-invite.ts when a studio manager invites
// someone to help manage it. Preview with `npm run email:dev`.

type StudioInviteEmailProps = {
  studioName: string;
  inviterName: string;
  acceptUrl: string;
};

export default function StudioInviteEmail({
  studioName,
  inviterName,
  acceptUrl,
}: StudioInviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{inviterName} invited you to manage {studioName} on DepCut</Preview>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="bg-white font-sans text-[#0F0E0D]">
          <Container className="mx-auto max-w-[520px] px-6 py-12">
            <Text className="text-[15px] leading-relaxed">
              <strong>{inviterName}</strong> invited you to help manage{" "}
              <strong>{studioName}</strong> on DepCut.
            </Text>
            <Button
              href={acceptUrl}
              className="my-6 rounded-lg bg-[#0F0E0D] px-5 py-3 text-center text-[14px] font-semibold text-white"
            >
              Accept invite
            </Button>
            <Text className="text-[15px] leading-relaxed text-[#0F0E0D]/60">
              If you don&apos;t want to help manage this studio, you can ignore this email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

StudioInviteEmail.PreviewProps = {
  acceptUrl: "https://www.depcut.app/app/studio/invites/abc123",
  inviterName: "Jordan",
  studioName: "Viral Kings",
} satisfies StudioInviteEmailProps;
