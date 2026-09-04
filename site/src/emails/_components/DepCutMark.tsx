import { Img } from "react-email";

import { DEPCUT_LOGO_CID } from "./logo";

// The DepCut mark at the top of an email, referenced by Content-ID: the
// sender attaches the bytes from logo.ts under this id, so the image travels
// inside the message and no client fetches anything external. The preview
// server has no attachment to resolve, so it shows the alt box there.
export function DepCutMark() {
  return (
    <Img
      src={`cid:${DEPCUT_LOGO_CID}`}
      alt="DepCut"
      width="48"
      height="48"
      className="mb-4"
    />
  );
}
