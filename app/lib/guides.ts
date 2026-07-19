/**
 * The guides library — real, useful content for shelter people, which is
 * also our organic-traffic engine. Every guide targets searches shelters
 * actually make, funnels gently toward the importer or signup, and stays
 * honest (comparison claims must match the home-page chart).
 *
 * Authoring notes: paragraphs support [text](/path) internal links only.
 * h2 blocks are section headings; tip blocks render as callouts.
 */

export interface GuideBlock {
  h2?: string;
  p?: string;
  list?: string[];
  tip?: string;
}

export interface Guide {
  slug: string;
  title: string; // <title> — keep ≤60 chars where possible
  h1: string;
  description: string; // meta description ≤160
  category: "Playbooks" | "Switching" | "Compare";
  minutes: number;
  updated: string; // ISO date
  blocks: GuideBlock[];
  faq?: { q: string; a: string }[];
  cta: { text: string; label: string; to: string };
}

export const GUIDES: Guide[] = [
  // ---------------------------------------------------------------- switching
  {
    slug: "switch-shelter-software",
    title: "How to Switch Shelter Software Without Losing Data",
    h1: "How to switch shelter software without losing a single record",
    description:
      "A step-by-step migration plan for shelters: export everything, keep adopter–animal relationships intact, run parallel for a week, and switch with zero lost history.",
    category: "Switching",
    minutes: 8,
    updated: "2026-07-19",
    blocks: [
      {
        p: "Nobody switches shelter software for fun. You switch because the old system goes down on adoption-event Saturday, because support stopped answering, or because the bill quietly doubled. And then you stay stuck for another year, because the thought of re-typing four thousand records is worse than any outage.",
      },
      {
        p: "Here's the honest truth: a migration is a weekend project, not a rewrite of your shelter's history — if you do it in the right order.",
      },
      { h2: "Step 1: Export everything, even the mess" },
      {
        p: "Every system has some export path, even the ones that make it hard. Look for anything labeled export, reports, or backup, and grab CSVs (or Excel files) of animals, people, adoptions, medical records, and photos if you can get them. Don't clean anything yet — mess is fine, missing is not.",
      },
      {
        list: [
          "Animals — names, species, breeds, statuses, intake dates, microchips",
          "People — adopters, fosters, donors, volunteers, with emails and phones",
          "Adoptions — which person took which animal home, and when",
          "Medical — vaccines, procedures, due dates (grab everything; dates matter)",
          "Photos — even a folder of files named after animal IDs is workable",
        ],
      },
      {
        tip: "Export BEFORE you cancel. Some systems limit or disable exports the day your subscription lapses. Get your data out while you're still a paying customer.",
      },
      { h2: "Step 2: Protect the relationships" },
      {
        p: "The single most common migration disaster isn't lost rows — it's lost connections. The animals arrive, the people arrive, but nobody remembers that Biscuit went home with the Nguyens in 2023, or that Willow and Pepper are a bonded pair who must be adopted together. Spreadsheets survive; relationships die.",
      },
      {
        p: "Before importing anywhere, check your exports for linking columns: adopter IDs on adoption rows, animal IDs on medical rows, anything that says 'bonded' or references another animal. If your new system's importer doesn't understand those links, you'll be rebuilding them by hand for months. (This is exactly why we built the [free importer](/import) to preserve every relationship — adopter histories, medical timelines, and bonded pairs included — from any CSV or Excel export, no account required.)",
      },
      { h2: "Step 3: Do a trial import and read the flags" },
      {
        p: "A good importer tells you what it couldn't understand instead of silently dropping it. Run a trial, then read the exceptions report like a vet reads bloodwork: 40 rows flagged out of 4,000 is a great result — fix the 40, not the 4,000.",
      },
      { h2: "Step 4: Run both systems for one week" },
      {
        p: "Keep the old system read-only (stop entering new data there — one team, one source of truth) and do your real daily work in the new one. A week is enough to surface anything the trial missed while the old data is still reachable for spot checks.",
      },
      { h2: "Step 5: The switch-off checklist" },
      {
        list: [
          "Final incremental export of anything added since your first export",
          "Confirm record counts match: animals, people, adoptions",
          "Spot-check five animals end-to-end: photos, medical, adopter history",
          "Update your website links, Petfinder feed, and QR codes",
          "Download one last full backup of the old system, then cancel",
        ],
      },
      {
        p: "That's it. The shelters that get stuck are the ones who treat migration as one giant terrifying day. Treated as five small steps, it's a quiet week — and on the other side, software that doesn't fight you.",
      },
    ],
    faq: [
      {
        q: "How long does a shelter software migration actually take?",
        a: "With clean exports, the import itself takes minutes. Budget a weekend for exporting and spot-checking, plus one parallel-running week for confidence. The months-long horror stories almost always come from re-typing by hand.",
      },
      {
        q: "What if my old system won't export photos?",
        a: "Import everything else first — photos are the one thing you can rebuild gradually. Many shelters treat it as a volunteer project: re-shoot the animals still in care (newer photos perform better anyway) and let adopted animals' records stand without them.",
      },
      {
        q: "Will adopter and medical history survive the move?",
        a: "Only if your importer understands relationships, not just rows. Test with a trial import and check one animal's full story before committing. Via Tutela's importer preserves adopter links, medical timelines, and bonded pairs from any CSV or Excel export.",
      },
    ],
    cta: {
      text: "Try it with your real exports — free, no account, nothing saved until you say so.",
      label: "Try the free importer",
      to: "/import",
    },
  },

  // ---------------------------------------------------------------- playbooks
  {
    slug: "adoption-bios-that-work",
    title: "How to Write Adoption Bios That Get Applications",
    h1: "Adoption bios that make someone stop scrolling",
    description:
      "A practical formula for shelter adoption bios: lead with personality, be honest about quirks, write for one reader, and end with a next step. With before/after examples.",
    category: "Playbooks",
    minutes: 6,
    updated: "2026-07-19",
    blocks: [
      {
        p: "\"Sweet boy looking for his forever home. Good with kids. Up to date on shots.\" — that bio describes eleven thousand dogs on Petfinder right now, and it gets none of them adopted faster. The bios that work read like a friend telling you about someone you should meet.",
      },
      { h2: "Lead with the one true thing" },
      {
        p: "Every animal has one detail that makes volunteers laugh or melt — the cat who insists on supervising the dishwasher, the dog who carries his food bowl to the door when it's dinner time. Open with that. Specific beats sweet every single time, because specific is what people repeat to their partner at dinner.",
      },
      { h2: "The four-sentence skeleton" },
      {
        list: [
          "The hook: one vivid, specific behavior or habit. Make it visual.",
          "The vibe: energy level and affection style, in plain words — 'couch barnacle' beats 'moderate energy'.",
          "The honest bit: the quirk or need, framed as a fit question, not a defect.",
          "The invitation: who their person is, and what to do next.",
        ],
      },
      { h2: "Honesty is a filter, and filters are good" },
      {
        p: "Hiding the fact that Luna needs to be the only pet doesn't get Luna adopted — it gets Luna returned. Returns are worse than waiting: worse for the animal, worse for the family, worse for your stats. Write the quirk as a matching problem: \"Luna wants all your love and none of the competition — a one-pet home is her dream.\" The right applicant reads that and thinks: that's me.",
      },
      {
        tip: "Read your bio out loud. If it sounds like a form, rewrite it. If it sounds like you telling a friend about the animal, ship it.",
      },
      { h2: "Words that quietly hurt you" },
      {
        p: "Skip the shelter jargon that reads as red flags to normal people: 'needs experienced handler' (say what handling, exactly), 'no small children' without context, breed-label soup, and long medical acronym lists. Say the true thing in kitchen-table language, and save clinical detail for the meet-and-greet conversation.",
      },
      { h2: "Let the AI draft, let a human decide" },
      {
        p: "The blank page is the real enemy — most shelves of animals go bio-less because nobody had twenty free minutes. This is a place where AI genuinely helps: [Via Tutela's bio writer](/signup) drafts from the animal's actual profile — age, quirks, staff notes, even what's visible in their photos — in your shelter's voice, honestly labeling what it doesn't know. A person reads it, fixes the one wrong detail, and publishes. Two minutes instead of twenty, and nothing goes live without human eyes.",
      },
    ],
    faq: [
      {
        q: "How long should an adoption bio be?",
        a: "Two short paragraphs — roughly 80 to 150 words. Long enough for a hook, a vibe, one honest note, and an invitation; short enough to read on a phone in a checkout line.",
      },
      {
        q: "Should the bio mention medical issues?",
        a: "Mention what changes daily life (insulin shots, joint meds, a special diet) framed as care their person will give, with costs discussed at the meet. Leave full clinical history for the conversation — it belongs with a human explaining it.",
      },
    ],
    cta: {
      text: "Every Via Tutela animal page gets an AI bio draft, a share bar, and a print-ready flyer.",
      label: "See it on the live demo",
      to: "/demo",
    },
  },

  {
    slug: "shelter-photos-phone",
    title: "Better Shelter Photos With the Phone You Already Own",
    h1: "Shelter photos that get animals seen — no camera budget required",
    description:
      "Light, level, patience, edit: a shelter photography playbook for phones. Why photos move adoption rates, and a 10-minute routine any volunteer can run.",
    category: "Playbooks",
    minutes: 7,
    updated: "2026-07-19",
    blocks: [
      {
        p: "Adopters scroll. Photos stop thumbs. Shelters have seen results as dramatic as a 127% higher adoption rate after upgrading photos and listings (Palm Valley Animal Society's pilot), and Pedigree's 'Adoptable' campaign drove 6x more profile visits with enhanced photos. Your mileage will vary — but the direction never does: better photos, more meets.",
      },
      { h2: "Light is 80% of it" },
      {
        p: "Kennel fluorescents make every animal look sick and every photo look like evidence. Get within ten feet of a window, or step outside into open shade (direct noon sun is almost as bad as fluorescents). Face the animal toward the light, you with your back to it. That one change beats any filter ever made.",
      },
      { h2: "Get on their level" },
      {
        p: "Photos shot down from human height read as 'small, far away, in a cage.' Kneel or sit so the lens is at the animal's eye level. Eye contact with the camera is the single strongest signal in adoption photos — a squeaky toy held just above your phone gets you three seconds of it.",
      },
      { h2: "The 10-minute routine" },
      {
        list: [
          "Wipe the lens. (Seriously. Kennel-dust haze ruins more photos than bad framing.)",
          "One helper handles the animal; you only shoot.",
          "Burst mode near a window or in open shade — 30 frames costs nothing.",
          "Get: one face close-up with eye contact, one full body standing, one 'personality' shot mid-play.",
          "Pick the best three. Delete the rest without mercy.",
        ],
      },
      {
        tip: "A 30-second video out-performs ten photos for dogs with kennel stress — many animals who shut down in stills light up in motion. Shoot one per animal while you're there.",
      },
      { h2: "Edit honestly" },
      {
        p: "A gentle brightness lift, a touch of contrast, a little sharpening — that's a service to the animal, because it shows what your eyes actually saw in bad lighting. Changing how the animal looks is a betrayal that gets discovered at the meet-and-greet. Enhance what the camera captured, never fabricate what it didn't.",
      },
      {
        p: "This is exactly how [Via Tutela's photo studio](/signup) works: the AI suggests gentle, clamped adjustments with a before/after preview, a human approves or discards, and the original is always kept. It can also score a set of photos, tell you which should lead the page, and cut face-centered crops for social — the whole routine above, minus the fiddling.",
      },
    ],
    faq: [
      {
        q: "Do professional photos really increase adoptions?",
        a: "The research direction is consistent: better photos mean more profile views and more meets, with individual shelters reporting dramatic gains (Palm Valley's pilot measured a 127% higher adoption rate). You don't need a professional — you need light, eye level, and a clean lens.",
      },
      {
        q: "What's the best first photo for an adoption listing?",
        a: "A sharp face close-up with eye contact, taken at the animal's eye level in soft light. It's the thumbnail everywhere — feeds, search results, share cards — so spend your best frame there.",
      },
    ],
    cta: {
      text: "AI photo review, one-tap enhancement, and social crops are built into every animal page.",
      label: "Get started",
      to: "/signup",
    },
  },

  {
    slug: "social-media-for-shelters",
    title: "Social Media for Animal Shelters: What Actually Works",
    h1: "Social media that sends animals home (not just likes)",
    description:
      "Shares beat likes, Facebook still leads, and consistency beats virality. A realistic social playbook for shelters with no marketing staff.",
    category: "Playbooks",
    minutes: 7,
    updated: "2026-07-19",
    blocks: [
      {
        p: "The numbers are unambiguous: 66% of shelters say social media increased their adoptions (ASPCA's survey of 800+ shelters), and 88% name Facebook their #1 adoption driver (Morrison et al., 2024). And a peer-reviewed Facebook study found the metric that matters is shares, not likes — a like is a nod; a share is a volunteer doing your marketing to their whole street.",
      },
      { h2: "Post for the share, not the like" },
      {
        p: "People share things that make them feel something they want their friends to feel. That means: one animal at a time, a name, a face, a story with a hook — not an album of 14 thumbnails. 'Biscuit has been here 197 days and greets every visitor with a toy' travels. 'Adoption event Saturday!' doesn't.",
      },
      { h2: "The sustainable cadence" },
      {
        list: [
          "3 posts a week beats 12 one week and zero for a month — algorithms and followers both reward rhythm.",
          "Monday: one animal spotlight (your longest-stay friend deserves the slot).",
          "Wednesday: behind-the-scenes — intake day, a foster update, the volunteer who shows up at 6am.",
          "Weekend: the celebration post. Adoption-day photos are your best-performing content, every time.",
        ],
      },
      { h2: "Make sharing effortless for your people" },
      {
        p: "Your volunteers and fosters WANT to share — every click you save them multiplies reach. Every animal needs a public page with a one-tap share bar (Facebook, Nextdoor, WhatsApp, plain text messages — where actual neighbors actually are), links that unfurl with the animal's photo, and a flyer anyone can print. That's the machinery [Via Tutela builds into every animal page](/demo) automatically.",
      },
      { h2: "Don't sleep on the unglamorous channels" },
      {
        p: "Nextdoor reaches the exact radius your adopters live in. Local Facebook groups out-perform your own page for reach. And harder-to-place friends benefit most: senior and medical-needs pets see adoption boosts around 55% from social attention (ASPCA) — the internet loves an underdog story told honestly.",
      },
      {
        tip: "Recycle winners. A long-stay animal deserves a fresh post every few weeks with a new photo and angle — 'still waiting' guilt posts underperform; 'new trick unlocked' posts overperform.",
      },
      { h2: "When there's no one to write it" },
      {
        p: "The cadence above dies the week your one social-media volunteer gets busy. That's the gap [Via Tutela's Marketing Studio](/signup) fills: it drafts channel-ready posts in your shelter's voice — new-arrival announcements, long-stay spotlights, adoption celebrations — and queues them for a human to approve. Nothing posts itself; everything is ready when you are.",
      },
    ],
    faq: [
      {
        q: "Which social platform is best for animal shelters?",
        a: "Facebook remains the workhorse — 88% of shelters call it their top adoption driver (Morrison et al., 2024) — with Nextdoor underrated for its pure local reach. Go where your adopters' parents and neighbors already scroll.",
      },
      {
        q: "How often should a shelter post on social media?",
        a: "Three times a week, sustainably, beats any burst. One animal spotlight, one behind-the-scenes, one celebration. Consistency compounds; virality is a lottery ticket.",
      },
    ],
    cta: {
      text: "Share bars, launch kits, and AI-drafted posts — marketing help that never posts without you.",
      label: "Get started",
      to: "/signup",
    },
  },

  {
    slug: "grants-for-animal-shelters",
    title: "Grants for Animal Shelters: Where to Look, How to Win",
    h1: "Grant money is out there — here's how small shelters actually get it",
    description:
      "The major grant sources for animal shelters and rescues (Petco Love, Best Friends, community foundations), what funders want to see, and how to keep grant-ready numbers.",
    category: "Playbooks",
    minutes: 8,
    updated: "2026-07-19",
    blocks: [
      {
        p: "Every year, millions of grant dollars for animal welfare go to the organizations that applied — which is a smaller club than you'd think. Most small rescues never apply, because the application asks for numbers they'd need a week to assemble and a narrative nobody has time to write. Both problems are fixable.",
      },
      { h2: "Where the money actually is" },
      {
        list: [
          "Petco Love — the largest recurring grant program for shelters and rescues; lifesaving and adoption-program grants on regular cycles.",
          "Best Friends Animal Society — network partner grants plus targeted lifesaving initiatives.",
          "Community foundations — search '[your county] community foundation'; local money loves local animals and is dramatically less competitive.",
          "Breed and cause-specific funds — senior pets, medical cases, spay/neuter programs all have dedicated funders.",
          "Local businesses — vet clinics, pet stores, and credit unions often sponsor when asked with one specific number and one story.",
        ],
      },
      { h2: "What every funder wants to see" },
      {
        p: "Strip away the portal differences and every application asks the same four things: How many animals, with what outcomes? Who does the work (staff and volunteer hours)? What exactly will this money do? How will you prove it did? Funders aren't buying sentiment — they're buying measurable lifesaving with a paper trail.",
      },
      { h2: "The real secret: keep grant-ready numbers year-round" },
      {
        p: "The shelters that win grants aren't better writers — they're better record-keepers. Intake and outcome counts, live-release rate, average length of stay, volunteer hours, donor counts: if your software tracks daily work properly, these fall out of a reports page instead of a shoebox. (Volunteer hours are the one everyone loses — log them as shifts happen, not at application time.)",
      },
      {
        tip: "Start local and small. A $2,500 community-foundation grant you win builds the track record that makes the $25,000 national application credible.",
      },
      { h2: "Writing the narrative without losing a week" },
      {
        p: "This is the blank-page problem again, and it's another place AI honestly earns its keep: [Via Tutela's grant writer](/signup) drafts a funder-ready narrative from your shelter's real outcomes, volunteer hours, and donor numbers — and it never invents a statistic, because invented statistics are how you lose a funder forever. You edit, you verify, you submit. The numbers were already there; now the words are too.",
      },
    ],
    faq: [
      {
        q: "What grants can a small animal rescue apply for?",
        a: "Start with Petco Love (the biggest recurring program), Best Friends network grants, and your county's community foundation — local grants are far less competitive. Cause-specific funds (seniors, medical, spay/neuter) fit small rescues especially well.",
      },
      {
        q: "What data do animal shelter grant applications require?",
        a: "Nearly all ask for intake and outcome counts, live-release rate, animals currently in care, volunteer hours, and a specific measurable plan for the funds. Software that tracks daily operations makes these a reports-page export instead of a week of spreadsheet archaeology.",
      },
    ],
    cta: {
      text: "Your numbers accumulate automatically; the grant writer turns them into a draft.",
      label: "Get started",
      to: "/signup",
    },
  },

  {
    slug: "reduce-adoption-returns",
    title: "How Shelters Reduce Adoption Returns (Post-Adoption Playbook)",
    h1: "Fewer returns, more forever: the post-adoption playbook",
    description:
      "Returns are preventable more often than they're inevitable: honest matching, a 3-day check-in, week-two support, and staying in touch until Gotcha Day.",
    category: "Playbooks",
    minutes: 6,
    updated: "2026-07-19",
    blocks: [
      {
        p: "A return hurts three times: the animal loses a home, the family loses confidence, and your team loses the kennel space they just celebrated freeing. Yet most returns trace back to two preventable moments — a mismatch nobody flagged, and a rough first week nobody checked on.",
      },
      { h2: "Prevention starts before the adoption" },
      {
        p: "Honest bios that state the quirk plainly (see [our bio guide](/guides/adoption-bios-that-work)) and application screening that flags mismatches early — high-energy dog, tenth-floor apartment, first-time owner — prevent more returns than any follow-up can. A match quiz on your adoption page does this work before you're even in the room.",
      },
      { h2: "The 3-3-3 reality, told out loud" },
      {
        p: "Three days of overwhelm, three weeks of settling, three months to full personality — every experienced shelter person knows the arc, and almost no adopter does. Say it at handoff, print it on the go-home sheet, and the day-4 'I think we made a mistake' call becomes a 'you said this would happen and it did' email.",
      },
      { h2: "The check-in cadence that works" },
      {
        list: [
          "Day 3: 'How's everyone sleeping?' — catches panic while it's still conversation-sized.",
          "Week 2: ask for a photo. It makes families articulate the bond forming — and gives you social content with permission.",
          "Month 6: a gentle 'how are things?' plus a soft invitation to support the shelter that matched them.",
          "Every year: a Gotcha Day card. Zero people expect it; everyone remembers it.",
        ],
      },
      {
        p: "None of this is hard — it's just relentless, which is why it dies as a manual process by February. [Via Tutela schedules the whole cadence automatically](/signup) on every recorded adoption: day-3 check-in, week-2 photo ask, month-6 hello, Gotcha Day every year. Your team writes nothing; adopters just feel remembered.",
      },
      {
        tip: "When a return does happen, make it shame-free and information-rich: a returned animal with honest behavior notes is dramatically easier to place right the second time.",
      },
    ],
    faq: [
      {
        q: "What percentage of shelter adoptions are returned?",
        a: "Commonly cited ranges run 7–20% depending on species, age, and screening. The encouraging part: returns cluster in the first weeks, exactly where a day-3 check-in and week-2 support call have the most effect.",
      },
      {
        q: "What is the 3-3-3 rule for adopted pets?",
        a: "A rule of thumb for decompression: three days of overwhelm, three weeks to settle into routines, three months to show full personality. Telling adopters at handoff reframes a hard first week as normal instead of a failed match.",
      },
    ],
    cta: {
      text: "Automatic post-adoption check-ins ship with every Via Tutela adoption.",
      label: "See the lifecycle features",
      to: "/#features",
    },
  },

  {
    slug: "starting-an-animal-rescue",
    title: "Starting an Animal Rescue: The Practical Checklist",
    h1: "So you're starting a rescue — the checklist nobody hands you",
    description:
      "The unglamorous essentials of founding an animal rescue: 501(c)(3), vet partner, foster network, intake criteria you'll actually keep, and systems from day one.",
    category: "Playbooks",
    minutes: 9,
    updated: "2026-07-19",
    blocks: [
      {
        p: "Every rescue starts the same way: one person who couldn't look away. Between that moment and a sustainable organization is a pile of unglamorous decisions — and the rescues that last are the ones that make them early, while everything still fits in a spreadsheet. (Briefly. Get out of the spreadsheet fast.)",
      },
      { h2: "The legal spine" },
      {
        list: [
          "Incorporate as a nonprofit in your state, then file IRS Form 1023 (or 1023-EZ if you qualify) for 501(c)(3) status — grants and tax-deductible donations both depend on it.",
          "Check state and county requirements: many require rescue/shelter licenses, foster-home inspections, or both.",
          "Get liability insurance before your first adoption event, not after your first incident.",
          "Write an adoption contract a lawyer has at least skimmed: return clause, spay/neuter terms, no-guarantee-of-health language.",
        ],
      },
      { h2: "The vet partner is your real co-founder" },
      {
        p: "Before your first intake, you need a clinic that answers your calls: negotiated rescue rates, an emergency protocol, and someone who'll squeeze in a parvo puppy at 6pm. One committed clinic beats five casual discounts. Budget honestly — veterinary costs are 40–60% of most rescues' spending.",
      },
      { h2: "Intake criteria: the hardest discipline in rescue" },
      {
        p: "Write down what you take, what you don't, and your maximum capacity — then obey it on the bad days. Every rescue that collapses does so the same way: intake outruns capacity, care quality slips, volunteers burn out, and the rescue becomes the emergency. Saying 'not this one, not right now' is how you're still here to say yes next year.",
      },
      { h2: "Fosters are your kennels" },
      {
        p: "A foster-based rescue's capacity IS its foster list. Recruit before you're desperate, onboard properly (supplies, vet protocol, one point of contact), and treat retention as sacred — a happy foster recruits two more; a burned-out one warns ten away.",
      },
      { h2: "Systems from day one, not day 400" },
      {
        p: "The pattern every rescue regrets: records live in texts, three spreadsheets, and one founder's memory until the day a vet asks for a vaccine date mid-emergency and nobody can find it. Start with real shelter software while you're small — animal records, medical timelines, adopter history, donation receipts in one place. [Via Tutela's Starter plan is $9 a month plus $1 per adoption](/signup) precisely so brand-new rescues can afford real systems from intake #1 — and if you're already drowning in spreadsheets, the [free importer](/import) turns them into organized records in an afternoon.",
      },
      {
        tip: "Open the bank account and start donation receipts in month one. Retroactively reconstructing finances for your 990 (or a grant application) is the most expensive spreadsheet archaeology there is.",
      },
    ],
    faq: [
      {
        q: "How much does it cost to start an animal rescue?",
        a: "Filing costs commonly run $500–$1,500 (state incorporation plus the IRS 1023-EZ fee), insurance a few hundred a year — but the real budget line is veterinary care, typically 40–60% of spending. Start with a funded vet reserve, even a small one.",
      },
      {
        q: "Do I need a 501(c)(3) to rescue animals?",
        a: "You can help animals without one, but you need it for tax-deductible donations, nearly all grants, and most transfer partnerships with municipal shelters. Most founders file within their first year; the 1023-EZ makes it manageable for small organizations.",
      },
      {
        q: "What software does a new rescue need?",
        a: "One system that holds animals, medical records, people, adoptions, and donations together — from day one, so history never lives in texts and memory. Via Tutela's Starter plan ($9/month + $1 per adoption) exists exactly for this stage.",
      },
    ],
    cta: {
      text: "Real systems at a founding-rescue price: $9/month plus $1 per adoption.",
      label: "Start your rescue's workspace",
      to: "/signup",
    },
  },

  // ---------------------------------------------------------------- compare
  {
    slug: "shelterluv-alternative",
    title: "Shelterluv Alternative: Via Tutela vs Shelterluv (2026)",
    h1: "Looking at Shelterluv? Here's an honest comparison",
    description:
      "Shelterluv vs Via Tutela: per-adoption pricing compared, data export, website builder, AI features, and how to migrate without losing records.",
    category: "Compare",
    minutes: 5,
    updated: "2026-07-19",
    blocks: [
      {
        p: "Shelterluv is a genuinely capable, widely loved system — shelters praise its adoption workflow and clean design, and if it's serving you well, we're not here to talk you out of it. This page is for shelters comparing options or feeling the per-adoption math add up.",
      },
      { h2: "The pricing shapes are different" },
      {
        p: "Shelterluv's model is usage-based at $2 per adoption (per their published pricing as of mid-2026 — always verify current rates). Via Tutela's Starter is $9 a month plus $1 per adoption, with flat tiers at $39 (Rescue) and $79/month (Shelter Pro) above it. A rescue doing 30 adoptions a month pays $60/month on pure per-adoption pricing at $2; on Via Tutela that volume lands on the flat $39 tier. Higher volume widens the gap; tiny volume narrows it — run your own numbers with the [savings calculator](/#savings).",
      },
      { h2: "Where Via Tutela goes further" },
      {
        list: [
          "A full website builder with themes, custom domain, and auto-SSL — your whole web presence, not only adoption listings",
          "AI across the workflow: match quiz, application triage, bio writer, photo studio, grant writer, marketing drafts — always human-approved",
          "A share-first adoption page for every animal: share bar, print flyer, videos, embed widget",
          "One-click full data export of every table, always — and a free importer in",
          "Post-adoption lifecycle automation through Gotcha Day, plus volunteer shifts and a donor CRM in every plan tier where you need them",
        ],
      },
      { h2: "Where Shelterluv has the edge" },
      {
        p: "Maturity and ecosystem. Shelterluv has years of production hardening, deep municipal-shelter workflows, established integrations, and a large community of shelters who can answer 'how do you handle X' from experience. If you need battle-tested processes for a large municipal operation today, that maturity is worth real money.",
      },
      { h2: "Switching without drama" },
      {
        p: "Export your animals, people, adoptions, and medical records from Shelterluv as CSVs, then run them through the [free importer](/import) — relationships (adopter history, medical timelines, bonded pairs) are preserved, flagged rows land in a tidy report, and nothing commits until you approve. Our [migration guide](/guides/switch-shelter-software) covers the full five-step plan.",
      },
    ],
    faq: [
      {
        q: "Is Via Tutela cheaper than Shelterluv?",
        a: "It depends on volume. At Shelterluv's published $2/adoption, 30 adoptions is $60/month; Via Tutela's flat Rescue tier is $39/month, and Starter ($9 + $1/adoption) is cheaper still at low volume. Check both calculators with your real numbers.",
      },
      {
        q: "Can I import my Shelterluv data into Via Tutela?",
        a: "Yes — export CSVs from Shelterluv and use the free importer (no account required to try it). Adopter relationships, medical history, and bonded pairs come through intact, with a flagged-rows report for anything ambiguous.",
      },
    ],
    cta: {
      text: "Bring your Shelterluv export and see your data organized in minutes — free.",
      label: "Try the free importer",
      to: "/import",
    },
  },

  {
    slug: "petpoint-alternative",
    title: "PetPoint Alternative: Via Tutela vs PetPoint (2026)",
    h1: "Beyond PetPoint: what 'free' costs, and what the alternative looks like",
    description:
      "PetPoint vs Via Tutela: the microchip-and-insurance model explained, data portability compared, and a migration path that keeps your history.",
    category: "Compare",
    minutes: 5,
    updated: "2026-07-19",
    blocks: [
      {
        p: "PetPoint is one of the most widely deployed shelter systems in North America, and for large operations plugged into its ecosystem it does serious work. But its famous price — free — deserves a clear-eyed look, because free has a shape.",
      },
      { h2: "How 'free' works" },
      {
        p: "PetPoint is operated by Pethealth, and the no-cost tiers are built around shelters promoting 24PetWatch microchips and insurance offers to adopters (per their published materials as of mid-2026). For some shelters that's a fine trade — the chips get registered, the software costs nothing. But it means your software vendor's customer is partly the adopter-data pipeline, not only you, and your workflows carry someone else's product placement.",
      },
      { h2: "The Via Tutela trade instead" },
      {
        p: "We charge money — $9/month + $1 per adoption to start, flat $39–$79 tiers above — and in exchange the incentives point one direction: at you. No product pushes at your adoption table, no strings on your adopter data, and a one-click export of every table whenever you want it. Your data is the product you own, not the price you pay.",
      },
      { h2: "Feature differences that matter day-to-day" },
      {
        list: [
          "A modern, phone-first interface — kennel QR cards open full profiles in the aisle",
          "A website builder with your own domain, themes, and auto-SSL",
          "AI helpers across intake, applications, bios, photos, grants, and marketing — all human-approved",
          "Share-first public adoption pages with flyers, videos, and embeds for every animal",
          "Transparent pricing on one page instead of a sales conversation",
        ],
      },
      { h2: "Where PetPoint holds advantages" },
      {
        p: "Scale and integration depth: national reporting pipelines, lost-and-found and chip-registration networks, and long-standing municipal contracts. A large city shelter embedded in those systems has real reasons to stay. A community rescue mostly using the animal-and-adopter basics has far fewer.",
      },
      { h2: "Getting your data out" },
      {
        p: "PetPoint offers report exports — pull animals, people, outcomes, and medical as CSVs (do it while your access is active), then run them through the [free importer](/import). The [migration guide](/guides/switch-shelter-software) covers the order of operations, including the parallel week.",
      },
    ],
    faq: [
      {
        q: "Is PetPoint really free for shelters?",
        a: "The no-cost tiers are subsidized by promoting 24PetWatch microchip and insurance products to your adopters (per published materials as of mid-2026). Whether that trade suits your shelter is a values question as much as a budget one.",
      },
      {
        q: "Can I migrate from PetPoint to Via Tutela?",
        a: "Yes. Export your reports as CSVs while your access is active, then use the free importer — it preserves adopter relationships and medical history and flags anything ambiguous for review before committing.",
      },
    ],
    cta: {
      text: "Software whose only customer is you — see your PetPoint export organized in minutes.",
      label: "Try the free importer",
      to: "/import",
    },
  },

  {
    slug: "rescuegroups-alternative",
    title: "RescueGroups Alternative: Via Tutela vs RescueGroups (2026)",
    h1: "Outgrowing RescueGroups? Here's the honest comparison",
    description:
      "RescueGroups.org vs Via Tutela: modular add-ons vs all-in-one, website capabilities, AI features, and how to migrate your data intact.",
    category: "Compare",
    minutes: 5,
    updated: "2026-07-19",
    blocks: [
      {
        p: "RescueGroups.org has been a backbone of volunteer rescue for two decades — nonprofit-run, affordable ($75–$100/year modular services per their published pricing as of mid-2026), and responsible for getting an enormous number of animals online. Plenty of rescues start there, and start well.",
      },
      { h2: "The modular model, and when it pinches" },
      {
        p: "RescueGroups is built as separate services — animal data here, website add-on there, email elsewhere — which keeps entry prices low but means the 'system' is something you assemble. The common growing pain: data and workflows living in loosely-joined pieces, an older interface, and volunteers maintaining glue instead of walking dogs.",
      },
      { h2: "What all-in-one buys you" },
      {
        list: [
          "One workspace: animals, medical, adopters, fosters, volunteers, donors, website, marketing — no add-on assembly",
          "A modern website builder (themes, custom domain, auto-SSL) instead of a separate web-service add-on",
          "AI throughout: match quiz, application triage, bios, photo studio, grant writer — human-approved always",
          "Phone-first daily work: kennel QR lookups, share bars, one-tap flyers",
          "Automation: waitlist alerts, post-adoption check-ins through Gotcha Day, marketing drafts",
        ],
      },
      { h2: "The honest price comparison" },
      {
        p: "RescueGroups' modular pricing ($75–$100/year range) is genuinely hard to beat on raw dollars, and for an all-volunteer rescue with simple needs it may stay the right answer. Via Tutela's Starter is $9/month + $1 per adoption — more per year, in exchange for the all-in-one workspace, the AI tools, and the hours of volunteer glue-work it removes. Price the hours, not just the subscription.",
      },
      { h2: "Migration is the easy part" },
      {
        p: "RescueGroups supports CSV exports of animals, contacts, and adoptions. Run them through the [free importer](/import) — relationships preserved, flagged rows reported, nothing committed until you approve — and follow the [five-step migration plan](/guides/switch-shelter-software). Most rescues complete the move in a weekend.",
      },
    ],
    faq: [
      {
        q: "What does RescueGroups.org cost compared to Via Tutela?",
        a: "RescueGroups' modular services run roughly $75–$100/year (published pricing, mid-2026). Via Tutela Starter is $9/month + $1 per adoption with flat $39–$79 tiers above — more dollars, one integrated system. For many rescues the deciding line item is volunteer hours, not subscription cost.",
      },
      {
        q: "Can I move my RescueGroups data to Via Tutela?",
        a: "Yes — export your animals, contacts, and adoptions as CSVs and run them through the free importer. It preserves relationships (adopter history, bonded pairs) and gives you a flagged-rows report before anything commits.",
      },
    ],
    cta: {
      text: "See your RescueGroups export as one organized workspace — free to try.",
      label: "Try the free importer",
      to: "/import",
    },
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export function relatedGuides(guide: Guide, n = 3): Guide[] {
  return GUIDES.filter((g) => g.slug !== guide.slug)
    .sort((a, b) => Number(b.category === guide.category) - Number(a.category === guide.category))
    .slice(0, n);
}

export const GUIDE_CATEGORIES: { key: Guide["category"]; label: string; blurb: string }[] = [
  { key: "Playbooks", label: "🐾 Playbooks", blurb: "Field-tested tactics for adoptions, photos, social, grants, and keeping forever homes forever." },
  { key: "Switching", label: "📦 Switching software", blurb: "Move systems without losing a record or a relationship." },
  { key: "Compare", label: "⚖️ Honest comparisons", blurb: "How Via Tutela stacks up — including where the other tool wins." },
];
