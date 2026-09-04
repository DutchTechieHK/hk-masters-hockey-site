// Seed defaults for admin-editable public-site page text.
// Snapshot of the baked-in content files at the time page text became
// admin-managed (Aug 2026). Once an admin saves, the DB is the source of
// truth; these remain only as first-boot seeds and public-site fallbacks.

export type PageTexts = Record<string, unknown>;

export const PAGE_TEXT_DEFAULTS: Record<string, PageTexts> = {
  home: {
    hero_title: "Hong Kong Masters Hockey",
    hero_tagline: "— Hockey For Life —",
    hero_intro:
      "We are Hong Kong's premier masters field hockey club, bringing together experienced players who love the sport. From local competitions to the World Masters Cup, we compete with passion and pride.",
    welcome_heading: "Welcome to HK Masters Hockey",
    welcome_text:
      "Hong Kong Masters Hockey has been at the forefront of masters-age field hockey in Asia for over two decades. We welcome players aged 35 and above who share a love for the game and a commitment to staying active, competitive, and connected to the global hockey community.",
    stats: [
      { stat: "36", label: "Registered Players" },
      { stat: "2", label: "Competing Squads" },
      { stat: "30+", label: "Caps" },
    ],
    // Rotterdam-mode hero (shown until the site switches back to normal mode)
    rtm_badge: "Rotterdam 2026 Masters World Cup",
    rtm_title: "Two Teams Representing\nHong Kong",
    rtm_subtitle: "MO40 · MO50 — at the World Masters Hockey World Cup",
    rtm_intro:
      "Hong Kong Masters Hockey is proud to send two squads to Rotterdam this July. Two categories, one city, one flag — competing on the world stage from 22 July to 1 August 2026.",
    rtm_button: "Meet the Squads →",
  },
  about: {
    mission_p1:
      "**Hong Kong Masters Hockey** exists to provide a high-quality, inclusive, and competitive environment for field hockey players aged 35 and above. We believe that age is no barrier to sporting excellence, and we are committed to fostering camaraderie, physical fitness, and the lifelong love of hockey.",
    mission_p2:
      "**Hong Kong Masters Hockey** refers to the masters (typically 35+ and older age groups) field hockey community in Hong Kong, organized under Hockey Hong Kong, China (HK Hockey), the national governing body affiliated with the FIH since 1952.\n\nIt focuses on players aged 35+ for tours, training, local leagues, and international events, with a dedicated Masters' Section Committee handling circulars, fixtures, results, and standings for divisions like Veterans.\n\nKey social channels include Instagram (@hkmastershockey, 778 followers, 284 posts on events and medals) and Facebook (official page for 35+ players' updates).\n\nRecent highlights: Hosted the 2025 Asian Continental Championships (Nov 26-30, 2025) with HK teams in O35-O40 Women and O40-O60 Men leagues; preparing for 2026 World Masters Hockey in Rotterdam.\n\n**HK HOCKEY VETERANS LEAGUE**\nHockey Hong Kong, China (HK Hockey) manages the Veterans Division (masters/veterans league for 40+ players) through its dedicated Masters' Section Committee, which oversees operations including league structure, registration, fixtures, results, and standings, and AGMs (e.g., June 2025 at HKFC).\n\nLeague structure is finalized annually via circulars, such as Hockey HKMS 25-26 Circular No. 8 (Aug 2025), which details divisions based on ~80 registered men's teams, team fees (HK$5,000/team), convenors' meetings, promotion/relegation guidelines, and bye-laws (e.g., uniform approval per Section 9.1).\n\nOperations involve club convenors for registration (player declarations via Google Forms, payments to HKHA HSBC account), weekly Friday night games (e.g., HKFC Men's Vets), and publishing fixtures/results/standings on hockey.org.hk (Veterans Division pages from 2014-15 onward).\n\nGovernance includes annual AGMs for committee elections (e.g., Chairman Simon Shepherdson), circulars for each season (2025-26 series), and adherence to HK Hockey bye-laws/code of conduct; contact via info@hockey.org.hk.\n\nClubs like HKFC and Kowloon Cricket Club field multiple vets teams in the league. This structure supports your HK Masters Hockey digital and event efforts.",
    committee: [
      { name: "Simon Shepherdson", role: "Master's Chairman" },
      { name: "René Theil", role: "Honorary Secretary" },
      { name: "Sophie Lindsay", role: "Honorary Treasurer" },
      { name: "Anna Cooke", role: "Ladie's Convenor" },
      { name: "Edward Chau", role: "Men's Convenor" },
    ],
    history_intro:
      "**The Hong Kong Masters Hockey** section was officially formed in 1983 within the Hong Kong Hockey Association (HKHA, now HK Hockey), after a group led by Peter Corley (nominated Chairman) and Jimmy Keir (Secretary) gained approval from president Krishan Lall to establish it as a dedicated section for veteran/masters players.\n\nThis followed early informal participation, with inspiration from Gerard Sharman after witnessing Australian Veterans events in Perth in 1980; the first HK representative team (managed/played by Jimmy Keir, captained by Zia Hussain) toured Perth in 1981 for games against Australia (initially triangular, becoming four nations including Malaysia/Singapore by 1982, marking the start of Pacific Rim Masters internationals).\n\nLocal leagues and tournaments began post-1983, with the Veterans Division (core of masters play) evident in records from 2014-15 (fixtures/results), and ongoing seasons like 2020-21 (starting Dec 2020), 2021-22 (starting Oct 2021), confirming structured Veterans League operations by the early 2010s at latest, though exact inaugural league date isn't specified beyond section formation.\n\nHKHK (founded 1933) has hosted major masters events like the 2008 Grand Masters World Cup (O60+), and HK teams competed internationally from 2011 (e.g., Singapore Masters Classics).",
    timeline: [
      {
        year: "1983",
        event: "Club Founded",
        detail:
          "Hong Kong Masters Hockey was established by a group of passionate former players determined to keep competing after 35.",
      },
      {
        year: "2008",
        event: "Grand Masters World Cup (O60+)",
        detail:
          "**Hosting the 2008 Grand Masters Hockey World Cup (Sep 12-21) in Hong Kong** had a positive impact, as noted in FIH announcements and contemporary reports praising the event's smooth organization despite challenging conditions.\\\n\\\n**The tournament featured high-quality international competition**, with 9 men's O60 teams (Australia, England, Germany, Holland, Hong Kong, Italy, Japan, Scotland, South Africa), 6 O65 teams (Australia, England, Germany, Japan, Scotland, Australia O70s), and a Trophy event; England won O60 (beating Australia), Australia took O65 by default—showcasing HK's ability to host multi-division world-class masters hockey open to the public.\n\n**It boosted local hockey visibility and legacy**, held at HKFC and Happy Valley with an official opening ceremony; reports highlighted HK's successful management, surprising quality of play, and role in global masters growth (post-1983 HK Masters formation), aligning with HK's history of events like the 2025 Asian Champs.",
      },
      {
        year: "2011",
        event: "HK teams competed internationally from 2011 (e.g., Singapore Masters Classics).",
        detail: "HK teams competed internationally from 2011 (e.g., Singapore Masters Classics).",
      },
      {
        year: "2018",
        event: "World Masters Cup, Barcelona",
        detail:
          "HK Masters sent three squads to Spain, achieving best-ever results with a bronze medal in O45.",
      },
      {
        year: "2022",
        event: "Club Rebrand",
        detail:
          "Refreshed club identity, updated kit design, and launched a new development programme for players aged 35–40.",
      },
      {
        year: "2023",
        event: "Asian Continental Cup 2023",
        detail: "HK Masters hosted the 2023 Asian Continental Cup here in Hong Kong.",
      },
      {
        year: "2025",
        event: "WMH | Asia Championship 2025",
        detail:
          "HK Masters hosted the World Masters Hockey Asia Championship 2025 here in Hong Kong.",
      },
      {
        year: "2026",
        event: "2026 WMH World Cup Rotterdam",
        detail:
          "Two squads are preparing to represent Hong Kong at the World Masters Cup in Rotterdam, Netherlands.",
      },
    ],
  },
  teams: {
    header_badge: "2026/27 Season",
    header_title: "Masters Teams — 2026/27 Season",
    header_subtitle:
      "A new men's team enters Division 1, and three ladies' teams return to the league this season.",
    mens_badge: "New for 2026/27",
    mens_heading: "Men's Masters Return to Division 1",
    mens_text:
      "For the first time in many years, HK Masters Hockey will field a men's team in the Hong Kong Hockey League, competing in the First Division. The season kicks off Friday 2 October, with fixtures every Friday night at 20:30 at the Hong Kong Football Club (HKFC).",
    trials_heading: "Trial Information",
    trials_details:
      "Trials — Friday 18 September & Friday 25 September, 20:00 at HKFC.",
    trials_text:
      "All Masters-eligible players (35+) welcome, whatever your experience level.",
    join_heading: "Trials Start 18 September",
    join_text:
      "Come try out for HK's first men's Masters team in years.",
    join_button_label: "Sign Up to Join →",
    join_url:
      "https://caramel-havarti-6da.notion.site/79a429c0d2cc4ccb96417607a58775f9?pvs=105",
    ladies_badge: "Ladies Masters",
    ladies_heading: "Three Teams Again This Season",
    ladies_text:
      "For another season, Hong Kong Masters Hockey fields three ladies' Masters teams (35+) in the Hong Kong Hockey League, drawn from our club's Premier League players. Masters A and Masters B compete in Division 1, Masters C in Division 2.",
  },
  rotterdam: {
    header_badge: "22 July - 1 August 2026",
    overview_p1:
      "The World Masters Hockey Cup is the premier international field hockey tournament for masters-age players, held every four years and organized by World Hockey. Rotterdam 2026 will see over 50 nations compete across four age categories, Over-35, Over-40, Over-45 and Over-50, at the world-class facilities of the Hockey Club Rotterdam.",
    overview_p2:
      "Hong Kong Masters Hockey is proud to be sending two squads, MO40 and MO50 — competing at the highest level of masters hockey. Years of preparation, fundraising, and training have gone into building squads that we believe can genuinely challenge for medals.",
    overview_p3:
      "For full tournament details including draw results, match schedules, and live scoring, visit the official World Hockey website once the tournament begins.\n\n**R\uFEFFOTTERDAM | MO50**\\\nhttps://worldmastershockey.org/wmhevents/2026-wct1-rotterdam\\\n\\\n**S\uFEFFCHIEDAM | MO40**\\\nhttps://worldmastershockey.org/wmhevents/2026-wc-schiedam",
    quick_facts: [
      { label: "Tournament", value: "World Masters Hockey Cup 2026" },
      {
        label: "Location",
        value: "https://www.hvvictoria.nl/ | Kralingseweg 226, 3062 CG Rotterdam, Netherlands",
      },
      { label: "Dates", value: "22 July – 1 August 2026" },
      { label: "HK Squads", value: "2 teams" },
      { label: "Organiser", value: "World Masters Hockey" },
      { label: "Venue", value: "Hockeyclub Rotterdam (TBC)" },
    ],
  },
  contact: {
    email: "play@hkmastershockey.com",
    phone: "+852 9765 1133",
    address: "c/o HKFC, 1 Sports Road, Happy Valley, Hong Kong",
    maps_embed_src: "",
    social: {
      facebook: "https://fb.com/hkmastershockey",
      instagram: "https://instagram.com/hkmastershockey",
      twitter: "X.com/hkmastershockey",
      youtube: "https://www.youtube.com/@HongKongMastersHockey",
    },
  },
  events: {
    intro: "The full tournament programme, club events, and social nights — all in one place.",
  },
  media: {
    intro: "Photos, videos, and highlights from Hong Kong Masters Hockey.",
  },
};

export const PAGE_TEXT_PAGES = Object.keys(PAGE_TEXT_DEFAULTS);
