export type GuideSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type Guide = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  tags: string[];
  sections: GuideSection[];
};

/**
 * Original editorial guides for AdSense / Search quality.
 * Keep these product-specific and practical — not generic travel filler.
 */
export const GUIDES: Guide[] = [
  {
    slug: "document-a-trip-on-taatom",
    title: "How to document a trip on Taatom without losing the story",
    description:
      "A practical workflow for capturing places, photos, captions, and music so your Taatom trip journal stays useful after you get home.",
    publishedAt: "2026-03-01",
    updatedAt: "2026-03-20",
    readingMinutes: 9,
    tags: ["journaling", "photos", "trips"],
    sections: [
      {
        heading: "Why trip documentation fails after day three",
        paragraphs: [
          "Most travel albums die the same way: hundreds of photos, almost no context, and no order. When you reopen the camera roll months later you remember that a café was “somewhere near the station,” but not which street, what you ate, or who was with you. Taatom is built to keep place, media, and narrative together so the story stays searchable.",
          "The goal is not to post every minute. The goal is to leave enough structure that a future reader — including you — can reconstruct the day. That means one clear place when it matters, a short caption that answers “why this moment,” and optional music that matches the mood without burying the photo.",
        ],
      },
      {
        heading: "A simple day-of workflow that actually sticks",
        paragraphs: [
          "Start with a single intention for the day: one destination or neighborhood you care about documenting well. Open Create when you arrive, not when you are already exhausted at the hotel. Capture two to five strong frames instead of twenty near-duplicates. If you are moving between places, publish separate posts per place rather than stuffing every stop into one caption.",
          "Add the location while you are still there. GPS accuracy is better outdoors, and you will not need to reverse-engineer a map pin at midnight. If privacy matters for that stop, set the post visibility before you publish — public, followers, or private — instead of editing after people have already seen it.",
        ],
        bullets: [
          "One primary place per post when the place is the point of the story.",
          "Captions that include a concrete detail: dish name, trail name, ticket line, weather, or timing.",
          "Music only when it strengthens the feeling of the clip; skip it for quiet documentary frames.",
          "Publish before you leave the area so location and lighting still match your memory.",
        ],
      },
      {
        heading: "Turning scattered posts into a readable journey",
        paragraphs: [
          "After a few days, open Journeys and group related posts into a single trip narrative. Order matters: morning market, midday hike, evening waterfront reads better than reverse-chronological camera chaos. A short journey introduction helps friends understand the route without opening every post.",
          "On web, public trips can be shared as links so people who do not have the app yet can still follow the path. Keep sensitive stops private or followers-only, and keep the journey highlight reel focused on places you are comfortable showing publicly.",
        ],
      },
      {
        heading: "Quality checklist before you hit publish",
        paragraphs: [
          "Ask three questions: Is the place accurate? Does the caption add something the photo cannot say alone? Would I be comfortable if this post stayed online for a year? If any answer is no, edit before publishing. That habit is what separates a lasting travel journal from a dump of files.",
          "Taatom rewards consistency more than perfection. Five well-placed posts across a week teach more about a destination than fifty unlabeled photos. Use Shorts for kinetic moments, long videos for deeper walks, and photo posts for still frames that need calm reading.",
        ],
      },
    ],
  },
  {
    slug: "understanding-tripscore",
    title: "Understanding TripScore: how Taatom maps where you have been",
    description:
      "Learn what TripScore represents, how countries and places accumulate, and how to use your travel map without turning travel into a vanity score chase.",
    publishedAt: "2026-03-05",
    updatedAt: "2026-03-20",
    readingMinutes: 8,
    tags: ["tripscore", "map", "travel"],
    sections: [
      {
        heading: "TripScore is a memory map, not a leaderboard",
        paragraphs: [
          "TripScore exists to answer a simple question: where have I actually been, and how is that story distributed across continents and countries? It is intentionally tied to places you document on Taatom rather than to empty check-ins. That keeps the map honest — a pin should correspond to a moment you chose to record.",
          "Treat TripScore as a personal atlas. Comparing numbers with strangers is less useful than noticing gaps: regions you keep promising to visit, cities you photographed but never wrote about, or countries that only appear as airports.",
        ],
      },
      {
        heading: "How places become part of your score",
        paragraphs: [
          "When you publish content with a location, Taatom can associate that place with your travel map. Over time, countries and continents fill in as you journal more of your real routes. The more carefully you tag places, the more accurate the map becomes — vague or missing locations leave holes that no algorithm should invent for you.",
          "If a place is sensitive (home address, private residence, temporary shelter), do not tag it publicly. TripScore should reflect exploration you are willing to remember, not locations that create safety risk.",
        ],
        bullets: [
          "Prefer specific public places: museums, parks, trails, stations, viewpoints.",
          "Avoid tagging private homes or temporary lodging unless you fully control visibility.",
          "Review older posts if a pin looks wrong; correcting place data keeps the map trustworthy.",
        ],
      },
      {
        heading: "Using the map to plan the next trip",
        paragraphs: [
          "Open your TripScore view before planning. Look for clusters where you already have rich posts — those clusters often hide unfinished stories worth a return visit. Also look for lonely pins: one photo in a country with no caption is a prompt to go deeper next time.",
          "Share the public side of your map only when it helps collaboration: friends planning a reunion route, family following a long journey, or a Connect page that curates destination tips. A map with context beats a map with empty bragging rights.",
        ],
      },
      {
        heading: "Healthy habits around travel metrics",
        paragraphs: [
          "If TripScore starts dictating where you go, pause. The product is meant to support storytelling, not pressure you into collecting countries for appearance. Some of the best Taatom journals cover a single neighborhood in depth. Depth still fills a meaningful map — just a denser one.",
          "Review privacy settings periodically. As your map grows, revisit which posts remain public. Travel identity changes over time; your published atlas should keep pace with what you want the world to see.",
        ],
      },
    ],
  },
  {
    slug: "privacy-and-location-sharing",
    title: "Travel photo privacy and location sharing on Taatom",
    description:
      "How to share trips confidently: profile visibility, post privacy, location tags, and practical rules for safer travel storytelling.",
    publishedAt: "2026-03-08",
    updatedAt: "2026-03-20",
    readingMinutes: 10,
    tags: ["privacy", "safety", "location"],
    sections: [
      {
        heading: "Privacy is part of the itinerary",
        paragraphs: [
          "Beautiful posts can still create risk if they reveal live locations, routines, or private addresses. Good travel storytelling separates “what I want friends to feel” from “what a stranger can reverse-engineer.” Taatom gives you profile-level and post-level controls so you can share without broadcasting every coordinate.",
          "Decide your default before the trip begins. If you usually post publicly, consider followers-only while you are still on the move, then open selected posts after you leave. That delay alone prevents real-time tracking of your hotel or daily route.",
        ],
      },
      {
        heading: "Choose visibility with intent",
        paragraphs: [
          "Public means anyone can discover the post. Followers limits the audience to people you accept. Private keeps the moment in your personal archive. Match visibility to the content: a famous viewpoint can be public; a family dinner at a relative’s house should usually not be.",
          "Profile visibility works the same way for your overall presence. If your profile is private or followers-only, new people must earn access before browsing your grid. That is useful for creators who want a quieter circle while still using Taatom’s journaling tools.",
        ],
        bullets: [
          "Delay public posting until you have left a sensitive location.",
          "Strip or omit precise pins for residences, schools, and workplaces.",
          "Review tagged people — friends may not want to appear in public travel posts.",
          "Use Connect pages for public destination tips while keeping personal posts narrower.",
        ],
      },
      {
        heading: "Location tags: useful, not mandatory",
        paragraphs: [
          "Location makes journals searchable and powers place pages, but it is optional. When a place is iconic and already crowded, tagging helps other travelers. When a place is fragile, sacred, or overcrowded by geotag tourism, consider describing the region without dropping a precise pin.",
          "On Navigate features, treat live tracking as a session tool for people you trust, not as a public broadcast. End sessions when you are done. Do not leave tracking running as ambient telemetry.",
        ],
      },
      {
        heading: "A quick safety review before you publish",
        paragraphs: [
          "Scan the frame for room numbers, luggage tags, boarding passes, keys, or identifiable children you do not have permission to feature. Read the caption for accidental disclosure (“our Airbnb on X street”). Confirm the audience. Then publish.",
          "If something slips through, edit or delete quickly and contact support if harassment follows. Privacy mistakes are recoverable when you act early; silence usually makes them worse.",
        ],
      },
    ],
  },
  {
    slug: "connect-pages-for-travel-communities",
    title: "Building a travel community with Taatom Connect",
    description:
      "How Connect pages, group chat, and subscriptions help creators and communities organize destination knowledge without turning every chat into noise.",
    publishedAt: "2026-03-10",
    updatedAt: "2026-03-20",
    readingMinutes: 9,
    tags: ["connect", "community", "creators"],
    sections: [
      {
        heading: "Connect is for ongoing places and themes",
        paragraphs: [
          "A personal profile is a timeline. A Connect page is a home base for a theme: a city guide, a trek series, a family travel club, or a creator’s premium notes. Followers subscribe to the page’s identity, not only to one person’s casual posts.",
          "Create a page when you have recurring value to publish — weekly tips, route updates, gear notes, or moderated discussion. If you only need one announcement, a regular post is enough.",
        ],
      },
      {
        heading: "Set visibility that matches the community",
        paragraphs: [
          "Public pages are discoverable and useful for open destination advice. Followers-only pages fit clubs that want content limited to people who opted in. Private pages suit closed groups. Admins can change visibility later as the community matures.",
          "Group chat works best with clear norms: what belongs in chat versus on the page feed, how often announcements go out, and how moderation handles spam. Mute notifications when you need quiet; unmute when you are coordinating a trip.",
        ],
        bullets: [
          "Write a short page bio that states who the page is for.",
          "Pin evergreen guides (best months to visit, transit cards, safety notes).",
          "Keep promotional posts secondary to useful local knowledge.",
          "Share the page link so members can invite people without forwarding screenshots.",
        ],
      },
      {
        heading: "Subscriptions without hype",
        paragraphs: [
          "If you enable paid content, make the free layer genuinely useful so followers understand the upgrade. Paid layers should add depth: detailed GPX-style route notes, packing lists, offline maps commentary, or member Q&A — not recycled free posts behind a lock.",
          "Be transparent about what subscribers get and how cancellations work. Trust compounds faster than short-term conversions.",
        ],
      },
      {
        heading: "Moderation habits that keep communities alive",
        paragraphs: [
          "Remove scams, hate, and doxxing immediately. Encourage members to ask specific questions (“night bus from A to B?”) instead of open-ended “tips?” prompts that produce noise. Celebrate members who contribute verified updates after visiting.",
          "A healthy Connect page feels like a maintained guide plus a respectful room — not an abandoned chat with ads and guesses.",
        ],
      },
    ],
  },
  {
    slug: "creator-monetization-explained",
    title: "Creator monetization on Taatom, explained clearly",
    description:
      "Eligibility, eligible views, payouts, and how Creator Monetization differs from Connect subscriptions — written for creators who want rules without hype.",
    publishedAt: "2026-03-12",
    updatedAt: "2026-03-20",
    readingMinutes: 11,
    tags: ["creators", "monetization", "video"],
    sections: [
      {
        heading: "Two different money paths",
        paragraphs: [
          "Taatom supports creator earnings in more than one way. Connect subscriptions are a direct relationship between a page and its members. Creator Monetization is a separate program based on eligible video performance and platform rules. Mixing the two in your mind leads to frustration; keep them separate in planning.",
          "Photos do not earn under Creator Monetization. Focus on original video you are allowed to monetize. Imported content may have additional eligibility rules — always check in-product guidance before assuming a clip counts.",
        ],
      },
      {
        heading: "Eligibility is earned, then maintained",
        paragraphs: [
          "Typical activation expects a meaningful follower base, multiple eligible videos in a calendar month, and a threshold of eligible views. Exact numbers appear in the Creator Dashboard and can evolve; treat the dashboard as the source of truth for your account.",
          "After activation, consistency matters. Falling below requirements for consecutive months can lock new earnings until you qualify again. That design rewards steady original publishing over spikes of low-quality uploads.",
        ],
        bullets: [
          "Publish original footage you own or have rights to monetize.",
          "Avoid buying views, bots, or view-exchange schemes — they can end program access.",
          "Use Creator Dashboard metrics, not third-party guesswork.",
          "Keep identity verification ready before requesting withdrawals.",
        ],
      },
      {
        heading: "What “eligible views” usually means in practice",
        paragraphs: [
          "Not every play is equal. Views from policy-violating behavior, manipulated traffic, or disallowed sources may not count. Build an audience that watches because the travel story is worth finishing. Watch-time quality beats empty counts.",
          "Longer videos that teach a route, explain a neighborhood, or document a hike with clear narration tend to hold attention better than rapid spam clips. Shorts can still work when they deliver a complete moment.",
        ],
      },
      {
        heading: "Payouts and responsibility",
        paragraphs: [
          "Earnings often remain pending until a monthly validation window closes. Minimum withdrawal amounts and verification steps protect both creators and the platform. Incomplete payout profiles delay money more often than “the system is broken.”",
          "Read Community Guidelines and copyright rules before scaling uploads. Monetization never overrides policy. A channel that earns briefly and then gets restricted is worse than a slower channel that lasts.",
        ],
      },
    ],
  },
  {
    slug: "navigate-safer-trip-sessions",
    title: "Planning safer trips with Taatom Navigate",
    description:
      "How to use live navigation sessions responsibly: who should see your route, when to start and stop tracking, and how web differs from the mobile app.",
    publishedAt: "2026-03-14",
    updatedAt: "2026-03-20",
    readingMinutes: 8,
    tags: ["navigate", "safety", "gps"],
    sections: [
      {
        heading: "Live location is a tool, not a lifestyle stream",
        paragraphs: [
          "Navigate helps companions follow a route while a trip is active. Used well, it reduces “where are you?” anxiety on group hikes and city days. Used carelessly, it publishes a moving target. Start with consent: everyone who can see the session should know they are watching live movement.",
          "On web, location typically works while the browser tab remains active. For reliable background GPS, use the mobile app. Do not assume a laptop tab equals continuous tracking.",
        ],
      },
      {
        heading: "Session hygiene",
        paragraphs: [
          "Start the session when you leave a meeting point. Share it only with the people who need it. End it when you reunite or reach a safe stop. If plans change, update the group in chat so nobody follows an obsolete route.",
          "Battery and signal matter outdoors. Download offline maps where your phone supports them, carry a power bank, and agree on a fallback meeting time if data drops.",
        ],
        bullets: [
          "Never leave a session running overnight by accident.",
          "Do not share live links in public comments or open Connect chats.",
          "Prefer named companions over broad audience shares.",
          "Stop tracking in sensitive areas such as private residences.",
        ],
      },
      {
        heading: "Pair Navigate with journaling",
        paragraphs: [
          "After the day, turn key stops into posts. The live session was for coordination; the journal is for memory. You do not need to publish the entire GPS trail. Choose the moments that tell the story and keep the rest in the private session history if available.",
          "If something goes wrong — injury, lost phone, harassment — end public sharing first, then contact local emergency services as needed, then reach Taatom support for account safety help.",
        ],
      },
    ],
  },
  {
    slug: "taatom-shorts-that-travel-well",
    title: "How to make Taatom Shorts that travelers actually watch",
    description:
      "Framing, pacing, captions, and music tips for travel Shorts that feel finished — without turning your trip into empty trends.",
    publishedAt: "2026-03-16",
    updatedAt: "2026-03-20",
    readingMinutes: 8,
    tags: ["shorts", "video", "music"],
    sections: [
      {
        heading: "One idea per Short",
        paragraphs: [
          "The Shorts that travel well usually answer one question in under a minute: how to buy the transit card, what the sunrise looked like from a specific ridge, how crowded the museum entry was at 9 a.m. If you try to summarize an entire country in fifteen seconds, viewers bounce.",
          "Film vertical, keep the subject large, and stabilize with two hands or a small grip. Wind noise ruins more travel audio than bad cameras do — face away from gusts or add a caption that carries the story alone.",
        ],
      },
      {
        heading: "Music and originality",
        paragraphs: [
          "When you use Taatom music, pick a licensed track that matches tempo without overpowering speech. Trim the hook to the moment you need. If you speak in the clip, lower music or skip it. Original ambient sound — markets, trains, waves — is often more memorable than a generic beat.",
          "Do not upload other people’s clips as your own. Remix culture still needs rights. Copyright complaints can remove content and affect monetization eligibility.",
        ],
      },
      {
        heading: "Captions that survive mute autoplay",
        paragraphs: [
          "Many people watch without sound. Put the key phrase on screen in the first second. Keep text short and high-contrast. End with a practical takeaway (“arrive before 8,” “carry cash for the ferry”) so the Short is useful after the dopamine fades.",
          "Link related photo posts or journey entries in your profile so viewers who care can go deeper. Shorts open the door; journals keep people inside the story.",
        ],
      },
    ],
  },
  {
    slug: "destination-journaling-best-practices",
    title: "Destination journaling best practices for clearer travel stories",
    description:
      "Research-light, experience-heavy journaling methods you can use in any city: what to note, what to skip, and how to keep entries readable on Taatom.",
    publishedAt: "2026-03-18",
    updatedAt: "2026-03-20",
    readingMinutes: 10,
    tags: ["journaling", "writing", "destinations"],
    sections: [
      {
        heading: "Write like a future traveler is reading",
        paragraphs: [
          "The most helpful journals answer questions a returning traveler would ask: How long did the line take? Which entrance was quieter? Was the viewpoint worth sunrise? What did lunch actually cost? Those details age better than adjectives like “amazing” or “unforgettable.”",
          "You do not need literary ambition. You need specificity. One precise paragraph beats a page of vague wonder.",
        ],
      },
      {
        heading: "A note template that fits a phone screen",
        paragraphs: [
          "Try four lines: place name, time of day, one sensory detail, one practical tip. Example: “Fort Kochi Chinese fishing nets — 5:40 p.m. — salt wind and diesel from the boats — arrive earlier on weekends; street photographers block the front rail by sunset.” That structure works for temples, trails, and train stations alike.",
          "Add a photo that matches the tip. If the tip is about a side entrance, show the side entrance. Mismatched media trains readers to ignore your captions.",
        ],
        bullets: [
          "Prefer local names plus a clarifying English nickname when useful.",
          "Record prices in the currency you paid, with an approximate date.",
          "Mention accessibility constraints you noticed (stairs, heat, uneven paths).",
          "Separate opinion (“I loved it”) from fact (“ticket office closed at 4”).",
        ],
      },
      {
        heading: "Ethics of recommending places",
        paragraphs: [
          "Some locations suffer when a precise pin goes viral. If a fragile beach, sacred site, or residential alley cannot handle crowds, recommend the broader district and the responsible visiting hours instead of a secret GPS drop. Good journaling includes restraint.",
          "Credit guides, hosts, and friends who helped you find a place. Mention closures or hazards honestly. A journal that sends people into danger is not generous — it is negligent.",
        ],
      },
      {
        heading: "Keep the archive alive after the trip",
        paragraphs: [
          "Within a week of returning, group posts into a journey, fix wrong locations, and add two or three missing captions while memory is fresh. That hour of curation is what makes Taatom more valuable than a dormant camera roll.",
          "Revisit old destinations when you learn something new. An updated caption (“ferry schedule changed in 2026”) helps the next traveler and strengthens your page as a living resource rather than a frozen diary.",
        ],
      },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export function getAllGuideSlugs(): string[] {
  return GUIDES.map((g) => g.slug);
}
