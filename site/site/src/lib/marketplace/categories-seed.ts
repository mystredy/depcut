// The single source for the creator marketplace's category taxonomy. The
// Category table self-seeds from this list on first read (see
// /api/categories) — pages fetch categories from the database, not from a
// hardcoded array of their own, so this is the only place the list lives.
export const CATEGORY_SEED: { name: string; emoji: string; niches: string }[] = [
  {
    name: "Entertainment",
    emoji: "🎬",
    niches:
      "Celebrity news, pop culture, viral moments, celebrity reactions, concert moments, funny clips, movie/TV commentary, internet drama, rankings",
  },
  {
    name: "Music",
    emoji: "🎵",
    niches:
      "Artist news, live performances, vocal analysis, song breakdowns, music history, artist comparisons, concert highlights, new releases",
  },
  {
    name: "Gaming",
    emoji: "🎮",
    niches:
      "Gameplay, gaming news, walkthroughs, challenges, reviews, esports, Minecraft, Roblox, Fortnite, GTA, mobile gaming",
  },
  {
    name: "Technology",
    emoji: "💻",
    niches: "AI, smartphones, gadgets, software, coding, cybersecurity, tech news, app reviews, website development, SaaS",
  },
  {
    name: "AI",
    emoji: "🤖",
    niches: "AI news, AI tools, tutorials, AI filmmaking, AI automation, prompt engineering, AI coding, AI business ideas",
  },
  {
    name: "Finance & Business",
    emoji: "💰",
    niches:
      "Personal finance, investing, entrepreneurship, side hustles, online businesses, marketing, e-commerce, business stories",
  },
  {
    name: "Education",
    emoji: "📚",
    niches: "Science, mathematics, history, geography, engineering, language learning, study tips, documentaries, explainers",
  },
  {
    name: "Science",
    emoji: "🔬",
    niches: "Space, physics, biology, chemistry, astronomy, experiments, scientific discoveries, interesting facts",
  },
  {
    name: "Automotive",
    emoji: "🏎️",
    niches: "Supercars, car reviews, modifications, racing, motorcycles, EVs, automotive news, car comparisons",
  },
  {
    name: "Sports",
    emoji: "⚽",
    niches: "Football, basketball, boxing, MMA, F1, tennis, sports news, athlete stories, match analysis, sports history",
  },
  {
    name: "Fitness",
    emoji: "🏋️",
    niches: "Workouts, sports training, nutrition education, fitness challenges, mobility, healthy habits",
  },
  {
    name: "Food",
    emoji: "🍔",
    niches: "Recipes, restaurant reviews, street food, cooking challenges, food history, celebrity food, international cuisine",
  },
  {
    name: "Travel",
    emoji: "✈️",
    niches: "Travel guides, luxury travel, budget travel, hotels, destinations, aviation, travel documentaries",
  },
  {
    name: "Fashion & Beauty",
    emoji: "👗",
    niches: "Fashion trends, outfits, skincare, makeup, hairstyles, luxury fashion, celebrity fashion",
  },
  {
    name: "Lifestyle",
    emoji: "🏠",
    niches: "Daily routines, productivity, organization, minimalism, home improvement, cleaning, life advice",
  },
  {
    name: "Comedy",
    emoji: "😂",
    niches: "Sketches, memes, reactions, parody, relatable comedy, observational humor",
  },
  {
    name: "Movies & TV",
    emoji: "🎥",
    niches: "Reviews, theories, recaps, endings explained, rankings, actor stories, movie facts",
  },
  {
    name: "Mystery",
    emoji: "🕵️",
    niches: "Unsolved mysteries, historical mysteries, strange events, disappearances, internet mysteries",
  },
  {
    name: "Storytelling",
    emoji: "📖",
    niches: "Personal stories, historical stories, celebrity stories, business stories, internet stories, animated storytelling",
  },
  {
    name: "Documentary",
    emoji: "🌍",
    niches: "History, countries, cultures, businesses, celebrities, technology, nature, geopolitics",
  },
  {
    name: "Animals & Nature",
    emoji: "🐾",
    niches: "Wildlife, pets, animal facts, ocean life, dinosaurs, nature documentaries",
  },
  {
    name: "Real Estate",
    emoji: "🏡",
    niches: "Luxury homes, house tours, property investing, architecture, tiny homes, celebrity homes",
  },
  {
    name: "Luxury",
    emoji: "💎",
    niches: "Billionaire lifestyles, yachts, private jets, watches, mansions, expensive products",
  },
  {
    name: "Psychology",
    emoji: "🧠",
    niches: "Human behavior, communication, habits, social psychology, relationships, decision-making",
  },
  {
    name: "Social Media",
    emoji: "📱",
    niches: "Creator news, TikTok trends, YouTube growth, influencer stories, platform updates, viral content",
  },
  {
    name: "Creative",
    emoji: "🎨",
    niches: "Video editing, photography, filmmaking, graphic design, animation, VFX, drawing",
  },
  {
    name: "DIY / How-to",
    emoji: "🛠️",
    niches: "Repairs, woodworking, crafts, electronics, building projects, tutorials",
  },
  {
    name: "News & Current Events",
    emoji: "📰",
    niches: "World news, tech news, entertainment news, business news, explainers",
  },
  {
    name: "Horror",
    emoji: "👻",
    niches: "Scary stories, paranormal stories, horror movies, creepy internet discoveries, urban legends",
  },
  {
    name: "Facts & Curiosity",
    emoji: "🧩",
    niches: "Interesting facts, comparisons, “Did you know?”, rare events, world records, strange discoveries",
  },
  {
    name: "Podcast / Commentary",
    emoji: "🎙️",
    niches: "Interviews, opinions, cultural commentary, entertainment discussion, creator discussions",
  },
  {
    name: "Family-friendly Entertainment",
    emoji: "👶",
    niches: "Family challenges, educational entertainment, crafts, toys, animation",
  },
  {
    name: "Wellness",
    emoji: "🧘",
    niches: "Sleep education, stress management, mindfulness, healthy routines, general wellbeing",
  },
];
