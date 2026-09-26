import type { BlogThemeId } from "@/lib/blog/themes";

import { BroadsheetList } from "./broadsheet";
import { BrutalistList } from "./brutalist";
import { BulletinList } from "./bulletin";
import { DeckList } from "./deck";
import { DigestList } from "./digest";
import { GlassList } from "./glass";
import { IndexCardList } from "./indexCard";
import { LedgerList } from "./ledger";
import { NightdeskList } from "./nightdesk";
import { PastelStackList } from "./pastelStack";
import { PolaroidList } from "./polaroid";
import { QuietPaperList } from "./quietPaper";
import type { BlogListPost } from "./shared";
import { TerminalList } from "./terminal";

export type { BlogListPost };

const THEME_LISTS: Record<BlogThemeId, (props: { posts: BlogListPost[] }) => React.JSX.Element> = {
  glass: GlassList,
  ledger: LedgerList,
  bulletin: BulletinList,
  quietPaper: QuietPaperList,
  nightdesk: NightdeskList,
  deck: DeckList,
  digest: DigestList,
  broadsheet: BroadsheetList,
  terminal: TerminalList,
  polaroid: PolaroidList,
  brutalist: BrutalistList,
  pastelStack: PastelStackList,
  indexCard: IndexCardList,
};

// The post grid/list on /blog and /blog/category/[slug] — which theme's own
// component renders depends on the site-wide setting (lib/blogSettings.ts).
export function BlogPostList({ theme, posts }: { theme: BlogThemeId; posts: BlogListPost[] }) {
  const List = THEME_LISTS[theme];
  return <List posts={posts} />;
}
