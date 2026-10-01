export interface Question {
  id: string;
  category: string;
  prompt: string;
  realAnswer: string;
  acceptableAnswers: string[];
  aiDecoys: string[];
  funFact: string;
}

export const QUESTIONS: Question[] = [
  {
    id: "q1",
    category: "BIZARRE HISTORY",
    prompt: "In 1923, jockey Frank Hayes won a steeplechase at Belmont Park despite suffering a fatal ________ mid-race.",
    realAnswer: "Heart attack",
    acceptableAnswers: ["heart attack", "cardiac arrest", "heart failure"],
    aiDecoys: ["Seizure", "Lightning strike", "Heat stroke"],
    funFact: "Frank Hayes suffered a fatal heart attack mid-race, but stayed in the saddle. His horse Sweet Kiss finished first at 20-1 odds, making him the only deceased jockey to win a race!"
  },
  {
    id: "q2",
    category: "ABSURD LAWS",
    prompt: "In the United Kingdom, it is legally forbidden under the 1986 Salmon Act to handle salmon in ________ circumstances.",
    realAnswer: "Suspicious",
    acceptableAnswers: ["suspicious", "fishy", "dubious"],
    aiDecoys: ["Drunken", "Romantic", "Formal wear"],
    funFact: "Section 32 of the 1986 Salmon Act is literally titled 'Handling Salmon in Suspicious Circumstances'. It was meant to stop salmon poachers!"
  },
  {
    id: "q3",
    category: "WEIRD ANIMAL FACTS",
    prompt: "Wombat droppings are naturally shaped like ________ to stop them from rolling away.",
    realAnswer: "Cubes",
    acceptableAnswers: ["cubes", "cube", "square", "dice"],
    aiDecoys: ["Pyramids", "Flat discs", "Hexagons"],
    funFact: "Wombats produce up to 100 cubic feces per night. The unique geometric shape prevents the poop from rolling down slopes and marks their territory!"
  },
  {
    id: "q4",
    category: "SPACE & SCIENCE",
    prompt: "Due to the absence of gravity, astronauts at the International Space Station can grow up to two inches taller because their ________ expands.",
    realAnswer: "Spine",
    acceptableAnswers: ["spine", "spinal column", "backbone", "vertebrae"],
    aiDecoys: ["Ribcage", "Neck cartilage", "Skull seam"],
    funFact: "Without gravity pushing down on them, spinal discs relax and expand, making astronauts about 3% taller while in orbit!"
  },
  {
    id: "q5",
    category: "MILITARY ODDITIES",
    prompt: "In 1932, the Australian military fought a prolonged, losing war against thousands of ________.",
    realAnswer: "Emus",
    acceptableAnswers: ["emus", "emu", "giant birds"],
    aiDecoys: ["Wild boars", "Kangaroos", "Feral camels"],
    funFact: "During the Great Emu War, soldiers armed with Lewis machine guns attempted to cull 20,000 crop-destroying emus. The agile birds scattered and outmaneuvered the military, leading to an emu victory!"
  },
  {
    id: "q6",
    category: "FOOD & DRINK",
    prompt: "In the 1830s in the United States, ketchup was originally bottled and sold as a medicine to cure ________.",
    realAnswer: "Diarrhea",
    acceptableAnswers: ["diarrhea", "indigestion", "upset stomach", "dysentery"],
    aiDecoys: ["Baldness", "Toothache", "Rheumatism"],
    funFact: "Dr. John Cook Bennett promoted tomato ketchup in 1834 as a miracle cure for indigestion, jaundice, and diarrhea before it became a condiment!"
  },
  {
    id: "q7",
    category: "BIZARRE HISTORY",
    prompt: "In 1974, the mummy of Pharaoh Ramesses II was issued an official Egyptian passport that listed his occupation as ________.",
    realAnswer: "King (deceased)",
    acceptableAnswers: ["king (deceased)", "king", "pharaoh", "deceased king"],
    aiDecoys: ["Archeological artifact", "Head of state", "Antique diplomat"],
    funFact: "France required everyone entering the country—dead or alive—to have a valid passport. Egypt officially issued one listing his occupation as 'King (deceased)'!"
  },
  {
    id: "q8",
    category: "ECCENTRIC INVENTIONS",
    prompt: "Thomas Edison proposed building entire suburban houses, including bathtubs and pianos, out of solid ________.",
    realAnswer: "Concrete",
    acceptableAnswers: ["concrete", "cement"],
    aiDecoys: ["Cast iron", "Pressed paper", "Pyrex glass"],
    funFact: "Edison designed single-pour concrete homes and even molded concrete furniture and phonograph cabinets, believing it was the cheap future of housing!"
  },
  {
    id: "q9",
    category: "ROYAL WEIRDNESS",
    prompt: "King Henry VIII of England employed four gentlemen whose esteemed official job title was 'Groom of the ________'.",
    realAnswer: "Stool",
    acceptableAnswers: ["stool", "royal stool", "toilet"],
    aiDecoys: ["Bedchamber beard", "Royal slippers", "Morning wig"],
    funFact: "The Groom of the Stool was one of the most powerful and intimate court positions—the courtier assisted the King during intimate bowel movements and privy visits!"
  },
  {
    id: "q10",
    category: "NATURE & CREATURES",
    prompt: "Sloths can hold their breath underwater for up to 40 minutes, which is longer than ________ can.",
    realAnswer: "Dolphins",
    acceptableAnswers: ["dolphins", "dolphin"],
    aiDecoys: ["Sea turtles", "Alligators", "Seals"],
    funFact: "By slowing their heart rate to a third of its normal pace, sloths can survive underwater up to 40 minutes, whereas dolphins must surface every 10-15 minutes!"
  },
  {
    id: "q11",
    category: "GLOBAL CULTURES",
    prompt: "In Switzerland, it is illegal under animal welfare laws to own only a single ________ because they easily get lonely.",
    realAnswer: "Guinea pig",
    acceptableAnswers: ["guinea pig", "guinea pigs", "parrot", "canary"],
    aiDecoys: ["Goldfish", "Hamster", "Rabbit"],
    funFact: "Swiss law considers guinea pigs highly social animals. Keeping only one is classified as animal cruelty; there are even matchmaking rent-a-pig services if one dies!"
  },
  {
    id: "q12",
    category: "ACCIDENTAL ORIGINS",
    prompt: "The slinky toy was accidentally invented by a naval engineer who was trying to develop a spring to stabilize ________.",
    realAnswer: "Ship instruments",
    acceptableAnswers: ["ship instruments", "instruments on ships", "naval meters", "compasses", "battleship meters"],
    aiDecoys: ["Torpedo fuses", "Submarine antennas", "Anchor chains"],
    funFact: "In 1943, Richard James accidentally knocked a tension spring off a shelf and watched it walk down a pile of books onto the floor, inspiring the classic toy!"
  },
  {
    id: "q13",
    category: "MODERN ODDITIES",
    prompt: "In 2013, a pair of twins born in Scotland were delivered an incredible 87 days apart because the mother's labor mysteriously ________.",
    realAnswer: "Stopped",
    acceptableAnswers: ["stopped", "paused", "halted", "delayed"],
    aiDecoys: ["Reversed", "Split into two wombs", "Went dormant"],
    funFact: "Amy Elliot gave birth to twin Amy 4 months premature, then contractions completely ceased. Twin Katie was born safe and healthy 87 days later!"
  },
  {
    id: "q14",
    category: "FASCINATING BIOLOGY",
    prompt: "A group of pugs is officially and delightfully known as a ________.",
    realAnswer: "Grumble",
    acceptableAnswers: ["grumble", "a grumble"],
    aiDecoys: ["Snort", "Puddle", "Waddle"],
    funFact: "Just as crows have a murder and lions have a pride, a collective pack of pugs is called a grumble!"
  },
  {
    id: "q15",
    category: "WACKY INVENTIONS",
    prompt: "Bubble wrap was originally invented in 1957 by two engineers who were trying to market it as textured ________.",
    realAnswer: "Wallpaper",
    acceptableAnswers: ["wallpaper", "wall paper", "wall covering"],
    aiDecoys: ["Greenhouse insulation", "Modernist carpet", "Ceiling acoustic tiles"],
    funFact: "Alfred Fielding and Marc Chavannes sealed two shower curtains together with air bubbles, pitching it as funky retro wallpaper before IBM used it for shipping!"
  },
  {
    id: "q16",
    category: "STRANGE TRADITIONS",
    prompt: "In Gloucestershire, England, people risk broken bones every year chasing an 8-pound wheel of ________ down a terrifyingly steep hill.",
    realAnswer: "Double Gloucester Cheese",
    acceptableAnswers: ["cheese", "double gloucester", "double gloucester cheese", "gloucester cheese"],
    aiDecoys: ["Hard cider wax", "Yorkshire pudding", "Salted pork lard"],
    funFact: "Cooper's Hill Cheese-Rolling attracts racers worldwide tumbling down a 1:2 gradient hill pursuing a runaway cheese wheel that reaches speeds up to 70 mph!"
  },
  {
    id: "q17",
    category: "BIZARRE HISTORY",
    prompt: "During the Cold War, the CIA spent $20 million on 'Acoustic Kitty', a project training a surgical spy cat equipped with a microphone in its ________.",
    realAnswer: "Ear canal",
    acceptableAnswers: ["ear", "ear canal", "earcanal"],
    aiDecoys: ["Collar bell", "Tooth filling", "Tail tip"],
    funFact: "The CIA surgically implanted a mic in the cat's ear and an antenna along its spine. On its very first field trial in Washington D.C., the cat was hit by a taxi!"
  },
  {
    id: "q18",
    category: "WEIRD SCIENCE",
    prompt: "Cows have been proven to produce significantly more milk when farmers play them soothing ________.",
    realAnswer: "Country or classical music",
    acceptableAnswers: ["music", "classical music", "slow music", "country music"],
    aiDecoys: ["Audiobooks", "Whale sounds", "Ocean waves"],
    funFact: "University of Leicester researchers found that cows listening to calming tracks (like REM's 'Everybody Hurts' or Beethoven) produced 3% more milk per day due to lowered stress!"
  },
  {
    id: "q19",
    category: "ABSURD LAWS",
    prompt: "In Milan, Italy, an ancient local ordinance dictates that citizens must have a ________ on their face at all times, except at funerals or hospitals.",
    realAnswer: "Smile",
    acceptableAnswers: ["smile", "smiling face"],
    aiDecoys: ["Moustache", "Clean shave", "Powder coat"],
    funFact: "An Austro-Hungarian era regulation in Milan required citizens to smile in public or risk a fine, with explicit exemptions only for hospital workers and funeral attendees!"
  },
  {
    id: "q20",
    category: "SURPRISING ORIGINS",
    prompt: "Play-Doh was originally formulated in the 1930s not as a children's toy, but as a commercial compound to clean ________.",
    realAnswer: "Wallpaper soot",
    acceptableAnswers: ["wallpaper", "soot from wallpaper", "coal soot", "soot", "wallpaper soot"],
    aiDecoys: ["Typewriter keys", "Window caulking", "Silverware tarnish"],
    funFact: "Kutol Products created it to clean coal soot residue off wallpaper. When oil/gas heating replaced coal, schoolteachers found kids loved sculpting with it!"
  }
];

export function getRandomQuestions(count: number = 3, excludeIds: string[] = []): Question[] {
  const available = QUESTIONS.filter(q => !excludeIds.includes(q.id));
  const pool = available.length >= count ? available : QUESTIONS;
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
