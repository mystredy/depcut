import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "react-email";

// Sent by src/lib/email/send-studio-invite-code.ts whenever a manager asks
// to invite someone to a studio — the code proves a human with inbox
// access approved this specific invite, before the invite email goes out
// to the invitee. Preview with `npm run email:dev`.

type StudioInviteCodeEmailProps = {
  studioName: string;
  inviteEmail: string;
  code: string;
};

export default function StudioInviteCodeEmail({
  studioName,
  inviteEmail,
  code,
}: StudioInviteCodeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your code: {code}</Preview>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="bg-white font-sans text-[#0F0E0D]">
          <Container className="mx-auto max-w-[520px] px-6 py-12">
            <Text className="text-[15px] leading-relaxed">
              Someone signed in as you asked to invite <strong>{inviteEmail}</strong> to
              manage <strong>{studioName}</strong> on DepCut.
            </Text>
            <Text className="my-6 text-center text-[32px] font-semibold tracking-widest">
              {code}
            </Text>
            <Text className="text-[15px] leading-relaxed">
              Enter this code to send the invite. It expires in 10 minutes.
            </Text>
            <Text className="text-[15px] leading-relaxed text-[#0F0E0D]/60">
              Wasn&apos;t you? Someone has access to your DepCut session — sign out of any
              devices you don&apos;t recognize.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

StudioInviteCodeEmail.PreviewProps = {
  code: "482913",
  inviteEmail: "someone@example.com",
  studioName: "Viral Kings",
} satisfies StudioInviteCodeEmailProps;
