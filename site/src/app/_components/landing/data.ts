import { DEPCUT_CANONICAL } from "@/cut/lib/hosts";

export const GITHUB_REPO_URL = "https://github.com/mystredy/depcut";
// The install page lives on depcut.com only, so landing CTAs link absolute.
export const DEPCUT_INSTALL_URL = `${DEPCUT_CANONICAL}/install`;
export const DEPCUT_LATEST_VERSION = "0.1.102";
export const DEPCUT_LATEST_RELEASE_TAG = `v${DEPCUT_LATEST_VERSION}`;
export const DEPCUT_DOWNLOAD_URL = `${GITHUB_REPO_URL}/releases/download/${DEPCUT_LATEST_RELEASE_TAG}/DepCut.dmg`;
