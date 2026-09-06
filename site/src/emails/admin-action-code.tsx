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

// Sent by src/lib/email/send-admin-action-code.ts whenever a superuser opens
// the confirm dialog for granting/revoking another account's super-user
// status — the code proves a human with inbox access approved it, not just
// that the browser session is authenticated. Preview with `npm run email:dev`.

type AdminActionCodeEmailProps = {
  actionLabel: string;
  targetEmail: string;
  code: string;
};

export default function AdminActionCodeEmail({
  actionLabel,
  targetEmail,
  code,
}: AdminActionCodeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your code: {code}</Preview>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="bg-white font-sans text-[#0F0E0D]">
          <Container className="mx-auto max-w-[520px] px-6 py-12">
            <Text className="text-[15px] leading-relaxed">
              Someone signed in as you asked to <strong>{actionLabel}</strong>{" "}
              for <strong>{targetEmail}</strong>.
            </Text>
            <Text className="my-6 text-center text-[32px] font-semibold tracking-widest">
              {code}
            </Text>
            <Text className="text-[15px] leading-relaxed">
              Enter this code to confirm. It expires in 10 minutes.
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

AdminActionCodeEmail.PreviewProps = {
  actionLabel: "make super user",
  code: "482913",
  targetEmail: "someone@example.com",
} satisfies AdminActionCodeEmailProps;
