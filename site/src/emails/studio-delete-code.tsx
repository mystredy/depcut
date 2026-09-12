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

// Sent by src/lib/email/send-studio-delete-code.ts whenever a studio owner
// starts deleting a studio — the code proves a human with inbox access
// approved this specific deletion, before it actually happens. Preview
// with `npm run email:dev`.

type StudioDeleteCodeEmailProps = {
  studioName: string;
  code: string;
};

export default function StudioDeleteCodeEmail({ studioName, code }: StudioDeleteCodeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your code: {code}</Preview>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="bg-white font-sans text-[#0F0E0D]">
          <Container className="mx-auto max-w-[520px] px-6 py-12">
            <Text className="text-[15px] leading-relaxed">
              Someone signed in as you asked to delete <strong>{studioName}</strong> on DepCut —
              its drops, managers, and connections all go with it.
            </Text>
            <Text className="my-6 text-center text-[32px] font-semibold tracking-widest">
              {code}
            </Text>
            <Text className="text-[15px] leading-relaxed">
              Enter this code to delete the studio. It expires in 10 minutes.
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

StudioDeleteCodeEmail.PreviewProps = {
  code: "482913",
  studioName: "Viral Kings",
} satisfies StudioDeleteCodeEmailProps;
