/**
 * Master catalog of every data path the layout-builder can bind to.
 *
 * One source of truth for every picker (Data / Toggle / Visibility). Each
 * option declares which purposes it's valid for, so the modal can filter
 * appropriately:
 *
 *   - 'data'       — value paths that render as text/number/image
 *   - 'toggle'     — boolean-y paths that drive a component's state1/state2 flip
 *   - 'visibility' — boolean-y paths that hide/show a component
 *
 * Most boolean paths are valid for both toggle + visibility. Numeric/string
 * paths are 'data' only.
 *
 * `slotContext: true` marks options that are short prefix-less names auto-
 * prefixed by the slot-expansion engine when bound inside a slot:0 template
 * (e.g. `score` becomes `setSlots.home.slot0.score`). These only show in the
 * picker when the field is inside a slotList template.
 */

export type PathPurpose = 'data' | 'toggle' | 'visibility' | 'condition';

export interface PathOption {
  /** Friendly human-readable label shown as the primary line. */
  label: string;
  /** Raw path written to the layout JSON. */
  value: string;
  /** Group title — used as the CollapsibleSection header in the modal. */
  group: string;
  /** Which picker purposes this option is valid for. */
  purposes: PathPurpose[];
  /** True if this is a short auto-prefixed slot-template path. */
  slotContext?: boolean;
  /** Optional one-line hint. */
  description?: string;
}

// Order in this array is the order of groups in the modal.
const GROUP_ORDER = [
  'Team',
  'Scores',
  'Clock & Period',
  'Status',
  'Stats',
  'Player',
  'Tennis LE',
  'Tennis Slot Template',
  'Leaderboard',
  'Leaderboard Slot Template',
  'Penalties (Lacrosse/Hockey)',
  'Penalty Slot Template',
  'Shootout',
  'Baseball',
  'Football',
  'Rugby',
  'Soccer',
  'Game Settings',
  'Sponsorship',
];

export const DATA_PATH_OPTIONS: PathOption[] = [
  // ── Team ───────────────────────────────────────────────────────────────
  { label: 'Home Team Name', value: 'homeTeam.name', group: 'Team', purposes: ['data'] },
  { label: 'Away Team Name', value: 'awayTeam.name', group: 'Team', purposes: ['data'] },
  { label: 'Home Team Color', value: 'home_team_color', group: 'Team', purposes: ['data'] },
  { label: 'Away Team Color', value: 'away_team_color', group: 'Team', purposes: ['data'] },

  // ── Scores ─────────────────────────────────────────────────────────────
  { label: 'Home Score', value: 'homeTeam.score', group: 'Scores', purposes: ['data'] },
  { label: 'Away Score', value: 'awayTeam.score', group: 'Scores', purposes: ['data'] },

  // ── Clock & Period ─────────────────────────────────────────────────────
  { label: 'Game Clock', value: 'gameClock', group: 'Clock & Period', purposes: ['data'] },
  { label: 'Shot Clock', value: 'shotClock', group: 'Clock & Period', purposes: ['data'] },
  { label: 'Period', value: 'period', group: 'Clock & Period', purposes: ['data'], description: 'Auto-shows OT label when period > totalPeriods' },
  { label: 'Total Periods', value: 'totalPeriods', group: 'Clock & Period', purposes: ['data'] },
  { label: 'Activity Clock', value: 'activityClock', group: 'Clock & Period', purposes: ['data'] },
  { label: 'Timeout Clock', value: 'timeoutClock', group: 'Clock & Period', purposes: ['data'] },
  { label: 'Timer Name', value: 'timerName', group: 'Clock & Period', purposes: ['data'] },
  { label: 'Session Name', value: 'sessionName', group: 'Clock & Period', purposes: ['data'] },
  { label: 'Next Up', value: 'nextUp', group: 'Clock & Period', purposes: ['data'] },

  // ── Status (booleans) ──────────────────────────────────────────────────
  { label: 'Overtime Active', value: 'isOvertimeActive', group: 'Status', purposes: ['toggle', 'visibility'] },
  { label: 'Home In Bonus', value: 'homeTeam.bonus', group: 'Status', purposes: ['toggle', 'visibility'] },
  { label: 'Away In Bonus', value: 'awayTeam.bonus', group: 'Status', purposes: ['toggle', 'visibility'] },
  { label: 'Home In Double Bonus', value: 'homeTeam.doubleBonus', group: 'Status', purposes: ['toggle', 'visibility'] },
  { label: 'Away In Double Bonus', value: 'awayTeam.doubleBonus', group: 'Status', purposes: ['toggle', 'visibility'] },
  { label: 'Home Has Possession', value: 'homeTeam.possession', group: 'Status', purposes: ['toggle', 'visibility'] },
  { label: 'Away Has Possession', value: 'awayTeam.possession', group: 'Status', purposes: ['toggle', 'visibility'] },

  // ── Stats ──────────────────────────────────────────────────────────────
  { label: 'Home Timeouts', value: 'homeTeam.timeouts', group: 'Stats', purposes: ['data'] },
  { label: 'Away Timeouts', value: 'awayTeam.timeouts', group: 'Stats', purposes: ['data'] },
  { label: 'Home Fouls', value: 'homeTeam.fouls', group: 'Stats', purposes: ['data'] },
  { label: 'Away Fouls', value: 'awayTeam.fouls', group: 'Stats', purposes: ['data'] },
  { label: 'Home Sets Won', value: 'home_sets_won', group: 'Stats', purposes: ['data'] },
  { label: 'Away Sets Won', value: 'away_sets_won', group: 'Stats', purposes: ['data'] },
  { label: 'Home Shots', value: 'home_shots', group: 'Stats', purposes: ['data'] },
  { label: 'Away Shots', value: 'away_shots', group: 'Stats', purposes: ['data'] },
  { label: 'Home Saves', value: 'home_saves', group: 'Stats', purposes: ['data'] },
  { label: 'Away Saves', value: 'away_saves', group: 'Stats', purposes: ['data'] },
  { label: 'Home Corner Kicks', value: 'home_corner_kicks', group: 'Stats', purposes: ['data'] },
  { label: 'Away Corner Kicks', value: 'away_corner_kicks', group: 'Stats', purposes: ['data'] },

  // ── Player ─────────────────────────────────────────────────────────────
  { label: 'Home Player Name', value: 'home_player_name', group: 'Player', purposes: ['data'] },
  { label: 'Away Player Name', value: 'away_player_name', group: 'Player', purposes: ['data'] },
  { label: 'Home Player Points', value: 'home_player_points', group: 'Player', purposes: ['data'] },
  { label: 'Away Player Points', value: 'away_player_points', group: 'Player', purposes: ['data'] },
  { label: 'Home Active Player Name', value: 'currentPlayer.home.name', group: 'Player', purposes: ['data'] },
  { label: 'Away Active Player Name', value: 'currentPlayer.away.name', group: 'Player', purposes: ['data'] },
  { label: 'Home Active Player Jersey', value: 'currentPlayer.home.jersey', group: 'Player', purposes: ['data'] },
  { label: 'Away Active Player Jersey', value: 'currentPlayer.away.jersey', group: 'Player', purposes: ['data'] },
  { label: 'Home Active Player Points', value: 'currentPlayer.home.points', group: 'Player', purposes: ['data'] },
  { label: 'Away Active Player Points', value: 'currentPlayer.away.points', group: 'Player', purposes: ['data'] },
  { label: 'Home Active Player Image', value: 'currentPlayer.home.imageUrl', group: 'Player', purposes: ['data'] },
  { label: 'Away Active Player Image', value: 'currentPlayer.away.imageUrl', group: 'Player', purposes: ['data'] },

  // ── Tennis LE — standalone (non-slot) ──────────────────────────────────
  { label: 'Tennis: Home Current Point', value: 'setSlots.homePoints', group: 'Tennis LE', purposes: ['data'], description: '0 / 15 / 30 / 40' },
  { label: 'Tennis: Away Current Point', value: 'setSlots.awayPoints', group: 'Tennis LE', purposes: ['data'] },
  { label: 'Tennis: Home Sets Won', value: 'setSlots.setsWon.home', group: 'Tennis LE', purposes: ['data'] },
  { label: 'Tennis: Away Sets Won', value: 'setSlots.setsWon.away', group: 'Tennis LE', purposes: ['data'] },
  { label: 'Tennis: Total Sets', value: 'setSlots.totalSets', group: 'Tennis LE', purposes: ['data'] },
  { label: 'Tennis: Points Tracking Enabled', value: 'setSlots.pointsEnabled', group: 'Tennis LE', purposes: ['toggle', 'visibility'] },

  // ── Tennis Slot Template (auto-prefixed) ───────────────────────────────
  { label: 'Set Number', value: 'setNumber', group: 'Tennis Slot Template', purposes: ['data'], slotContext: true },
  { label: 'Set Score', value: 'score', group: 'Tennis Slot Template', purposes: ['data'], slotContext: true },
  { label: 'Set Active (current set)', value: 'active', group: 'Tennis Slot Template', purposes: ['toggle', 'visibility'], slotContext: true },
  { label: 'Set Exists (within best-of)', value: 'exists', group: 'Tennis Slot Template', purposes: ['toggle', 'visibility'], slotContext: true },
  { label: 'Set Won (historical winner)', value: 'won', group: 'Tennis Slot Template', purposes: ['toggle', 'visibility'], slotContext: true },

  // ── Leaderboard ────────────────────────────────────────────────────────
  { label: 'Home Player Count', value: 'leaderboardSlots.home.count', group: 'Leaderboard', purposes: ['data'] },
  { label: 'Away Player Count', value: 'leaderboardSlots.away.count', group: 'Leaderboard', purposes: ['data'] },

  // ── Leaderboard Slot Template (auto-prefixed) ──────────────────────────
  { label: 'Player Jersey', value: 'jersey', group: 'Leaderboard Slot Template', purposes: ['data'], slotContext: true },
  { label: 'Player Name', value: 'name', group: 'Leaderboard Slot Template', purposes: ['data'], slotContext: true },
  { label: 'Player Points', value: 'points', group: 'Leaderboard Slot Template', purposes: ['data'], slotContext: true },
  { label: 'Player Fouls', value: 'fouls', group: 'Leaderboard Slot Template', purposes: ['data'], slotContext: true },
  { label: 'Player Aces', value: 'aces', group: 'Leaderboard Slot Template', purposes: ['data'], slotContext: true },
  { label: 'Player Kills', value: 'kills', group: 'Leaderboard Slot Template', purposes: ['data'], slotContext: true },
  { label: 'Player Blocks', value: 'blocks', group: 'Leaderboard Slot Template', purposes: ['data'], slotContext: true },
  { label: 'Player Image', value: 'imageUrl', group: 'Leaderboard Slot Template', purposes: ['data'], slotContext: true },
  { label: 'Is Top Scorer (Points)', value: 'isTopScorer', group: 'Leaderboard Slot Template', purposes: ['toggle', 'visibility'], slotContext: true },
  { label: 'Is Top Aces', value: 'isTopAces', group: 'Leaderboard Slot Template', purposes: ['toggle', 'visibility'], slotContext: true },
  { label: 'Is Top Kills', value: 'isTopKills', group: 'Leaderboard Slot Template', purposes: ['toggle', 'visibility'], slotContext: true },
  { label: 'Is Top Blocks', value: 'isTopBlocks', group: 'Leaderboard Slot Template', purposes: ['toggle', 'visibility'], slotContext: true },
  { label: 'Slot Active', value: 'active', group: 'Leaderboard Slot Template', purposes: ['toggle', 'visibility'], slotContext: true },

  // ── Penalties ──────────────────────────────────────────────────────────
  { label: 'Home Penalty Count', value: 'penaltySlots.home.count', group: 'Penalties (Lacrosse/Hockey)', purposes: ['data'] },
  { label: 'Away Penalty Count', value: 'penaltySlots.away.count', group: 'Penalties (Lacrosse/Hockey)', purposes: ['data'] },
  { label: 'Home: 0 Penalties', value: 'penaltySlots.home.isState0', group: 'Penalties (Lacrosse/Hockey)', purposes: ['toggle', 'visibility'] },
  { label: 'Home: 1 Penalty',  value: 'penaltySlots.home.isState1', group: 'Penalties (Lacrosse/Hockey)', purposes: ['toggle', 'visibility'] },
  { label: 'Home: 2 Penalties', value: 'penaltySlots.home.isState2', group: 'Penalties (Lacrosse/Hockey)', purposes: ['toggle', 'visibility'] },
  { label: 'Home: 3 Penalties', value: 'penaltySlots.home.isState3', group: 'Penalties (Lacrosse/Hockey)', purposes: ['toggle', 'visibility'] },
  { label: 'Away: 0 Penalties', value: 'penaltySlots.away.isState0', group: 'Penalties (Lacrosse/Hockey)', purposes: ['toggle', 'visibility'] },
  { label: 'Away: 1 Penalty',  value: 'penaltySlots.away.isState1', group: 'Penalties (Lacrosse/Hockey)', purposes: ['toggle', 'visibility'] },
  { label: 'Away: 2 Penalties', value: 'penaltySlots.away.isState2', group: 'Penalties (Lacrosse/Hockey)', purposes: ['toggle', 'visibility'] },
  { label: 'Away: 3 Penalties', value: 'penaltySlots.away.isState3', group: 'Penalties (Lacrosse/Hockey)', purposes: ['toggle', 'visibility'] },

  // ── Penalty Slot Template ──────────────────────────────────────────────
  { label: 'Penalty Jersey', value: 'jersey', group: 'Penalty Slot Template', purposes: ['data'], slotContext: true },
  { label: 'Penalty Time', value: 'time', group: 'Penalty Slot Template', purposes: ['data'], slotContext: true },
  { label: 'Penalty Active', value: 'active', group: 'Penalty Slot Template', purposes: ['toggle', 'visibility'], slotContext: true },

  // ── Shootout ───────────────────────────────────────────────────────────
  { label: 'Home Shootout Made', value: 'home_shootout_made', group: 'Shootout', purposes: ['data'] },
  { label: 'Away Shootout Made', value: 'away_shootout_made', group: 'Shootout', purposes: ['data'] },
  { label: 'Slot 1 Round #', value: 'shootoutSlots.0.round', group: 'Shootout', purposes: ['data'] },
  { label: 'Slot 2 Round #', value: 'shootoutSlots.1.round', group: 'Shootout', purposes: ['data'] },
  { label: 'Slot 3 Round #', value: 'shootoutSlots.2.round', group: 'Shootout', purposes: ['data'] },
  { label: 'Slot 4 Round #', value: 'shootoutSlots.3.round', group: 'Shootout', purposes: ['data'] },
  { label: 'Slot 5 Round #', value: 'shootoutSlots.4.round', group: 'Shootout', purposes: ['data'] },
  { label: 'Slot 1 Home State', value: 'shootoutSlots.0.homeState', group: 'Shootout', purposes: ['toggle'], description: '0=miss, 1=made' },
  { label: 'Slot 2 Home State', value: 'shootoutSlots.1.homeState', group: 'Shootout', purposes: ['toggle'], description: '0=miss, 1=made' },
  { label: 'Slot 3 Home State', value: 'shootoutSlots.2.homeState', group: 'Shootout', purposes: ['toggle'], description: '0=miss, 1=made' },
  { label: 'Slot 4 Home State', value: 'shootoutSlots.3.homeState', group: 'Shootout', purposes: ['toggle'], description: '0=miss, 1=made' },
  { label: 'Slot 5 Home State', value: 'shootoutSlots.4.homeState', group: 'Shootout', purposes: ['toggle'], description: '0=miss, 1=made' },
  { label: 'Slot 1 Away State', value: 'shootoutSlots.0.awayState', group: 'Shootout', purposes: ['toggle'], description: '0=miss, 1=made' },
  { label: 'Slot 2 Away State', value: 'shootoutSlots.1.awayState', group: 'Shootout', purposes: ['toggle'], description: '0=miss, 1=made' },
  { label: 'Slot 3 Away State', value: 'shootoutSlots.2.awayState', group: 'Shootout', purposes: ['toggle'], description: '0=miss, 1=made' },
  { label: 'Slot 4 Away State', value: 'shootoutSlots.3.awayState', group: 'Shootout', purposes: ['toggle'], description: '0=miss, 1=made' },
  { label: 'Slot 5 Away State', value: 'shootoutSlots.4.awayState', group: 'Shootout', purposes: ['toggle'], description: '0=miss, 1=made' },
  { label: 'Slot 1 Home Active', value: 'shootoutSlots.0.homeActive', group: 'Shootout', purposes: ['visibility'] },
  { label: 'Slot 2 Home Active', value: 'shootoutSlots.1.homeActive', group: 'Shootout', purposes: ['visibility'] },
  { label: 'Slot 3 Home Active', value: 'shootoutSlots.2.homeActive', group: 'Shootout', purposes: ['visibility'] },
  { label: 'Slot 4 Home Active', value: 'shootoutSlots.3.homeActive', group: 'Shootout', purposes: ['visibility'] },
  { label: 'Slot 5 Home Active', value: 'shootoutSlots.4.homeActive', group: 'Shootout', purposes: ['visibility'] },
  { label: 'Slot 1 Away Active', value: 'shootoutSlots.0.awayActive', group: 'Shootout', purposes: ['visibility'] },
  { label: 'Slot 2 Away Active', value: 'shootoutSlots.1.awayActive', group: 'Shootout', purposes: ['visibility'] },
  { label: 'Slot 3 Away Active', value: 'shootoutSlots.2.awayActive', group: 'Shootout', purposes: ['visibility'] },
  { label: 'Slot 4 Away Active', value: 'shootoutSlots.3.awayActive', group: 'Shootout', purposes: ['visibility'] },
  { label: 'Slot 5 Away Active', value: 'shootoutSlots.4.awayActive', group: 'Shootout', purposes: ['visibility'] },

  // ── Baseball ───────────────────────────────────────────────────────────
  { label: 'Balls', value: 'balls', group: 'Baseball', purposes: ['data'] },
  { label: 'Strikes', value: 'strikes', group: 'Baseball', purposes: ['data'] },
  { label: 'Outs', value: 'outs', group: 'Baseball', purposes: ['data'] },
  { label: 'First Base Occupied', value: 'firstBase', group: 'Baseball', purposes: ['toggle', 'visibility'] },
  { label: 'Second Base Occupied', value: 'secondBase', group: 'Baseball', purposes: ['toggle', 'visibility'] },
  { label: 'Third Base Occupied', value: 'thirdBase', group: 'Baseball', purposes: ['toggle', 'visibility'] },

  // ── Inning Slots (Baseball — visibility for current inning) ────────────
  { label: 'Slot 1 Is Current Inning', value: 'inningSlots.0.isCurrentInning', group: 'Baseball', purposes: ['visibility'] },
  { label: 'Slot 2 Is Current Inning', value: 'inningSlots.1.isCurrentInning', group: 'Baseball', purposes: ['visibility'] },
  { label: 'Slot 3 Is Current Inning', value: 'inningSlots.2.isCurrentInning', group: 'Baseball', purposes: ['visibility'] },
  { label: 'Slot 4 Is Current Inning', value: 'inningSlots.3.isCurrentInning', group: 'Baseball', purposes: ['visibility'] },
  { label: 'Slot 5 Is Current Inning', value: 'inningSlots.4.isCurrentInning', group: 'Baseball', purposes: ['visibility'] },
  { label: 'Slot 6 Is Current Inning', value: 'inningSlots.5.isCurrentInning', group: 'Baseball', purposes: ['visibility'] },
  { label: 'Slot 7 Is Current Inning', value: 'inningSlots.6.isCurrentInning', group: 'Baseball', purposes: ['visibility'] },
  { label: 'Slot 8 Is Current Inning', value: 'inningSlots.7.isCurrentInning', group: 'Baseball', purposes: ['visibility'] },
  { label: 'Slot 9 Is Current Inning', value: 'inningSlots.8.isCurrentInning', group: 'Baseball', purposes: ['visibility'] },

  // ── Penalty Slot active toggles (legacy — slot templates preferred) ────
  { label: 'Home Penalty 1 Active', value: 'penaltySlots.home.slot0.active', group: 'Penalties (Lacrosse/Hockey)', purposes: ['toggle', 'visibility'] },
  { label: 'Home Penalty 2 Active', value: 'penaltySlots.home.slot1.active', group: 'Penalties (Lacrosse/Hockey)', purposes: ['toggle', 'visibility'] },
  { label: 'Home Penalty 3 Active', value: 'penaltySlots.home.slot2.active', group: 'Penalties (Lacrosse/Hockey)', purposes: ['toggle', 'visibility'] },
  { label: 'Away Penalty 1 Active', value: 'penaltySlots.away.slot0.active', group: 'Penalties (Lacrosse/Hockey)', purposes: ['toggle', 'visibility'] },
  { label: 'Away Penalty 2 Active', value: 'penaltySlots.away.slot1.active', group: 'Penalties (Lacrosse/Hockey)', purposes: ['toggle', 'visibility'] },
  { label: 'Away Penalty 3 Active', value: 'penaltySlots.away.slot2.active', group: 'Penalties (Lacrosse/Hockey)', purposes: ['toggle', 'visibility'] },

  // ── Football ───────────────────────────────────────────────────────────
  { label: 'Down', value: 'down', group: 'Football', purposes: ['data'] },
  { label: 'Yards To Go', value: 'yardsToGo', group: 'Football', purposes: ['data'] },
  { label: 'Ball On', value: 'ballOn', group: 'Football', purposes: ['data'] },

  // ── Rugby ──────────────────────────────────────────────────────────────
  { label: 'Home Tries', value: 'home_tries', group: 'Rugby', purposes: ['data'] },
  { label: 'Away Tries', value: 'away_tries', group: 'Rugby', purposes: ['data'] },
  { label: 'Home Penalty Goals', value: 'home_penalty_goals', group: 'Rugby', purposes: ['data'] },
  { label: 'Away Penalty Goals', value: 'away_penalty_goals', group: 'Rugby', purposes: ['data'] },
  { label: 'Home Dropped Goals', value: 'home_dropped_goals', group: 'Rugby', purposes: ['data'] },
  { label: 'Away Dropped Goals', value: 'away_dropped_goals', group: 'Rugby', purposes: ['data'] },
  { label: 'Home Conversions', value: 'home_conversions', group: 'Rugby', purposes: ['data'] },
  { label: 'Away Conversions', value: 'away_conversions', group: 'Rugby', purposes: ['data'] },

  // ── Game Settings ──────────────────────────────────────────────────────
  { label: 'Display Clock', value: 'gameSettings.display_clock', group: 'Game Settings', purposes: ['toggle', 'visibility'] },

  // ── Sponsorship ────────────────────────────────────────────────────────
  { label: 'Banner Ads', value: 'user_sequences.banner', group: 'Sponsorship', purposes: ['data'] },
  { label: 'Timeout Ads', value: 'user_sequences.timeout', group: 'Sponsorship', purposes: ['data'] },
  { label: 'Halftime Ads', value: 'user_sequences.halftime', group: 'Sponsorship', purposes: ['data'] },
  { label: 'Period Break Ads', value: 'user_sequences.period-break', group: 'Sponsorship', purposes: ['data'] },
  { label: 'Pre-Game Ads', value: 'user_sequences.pre-game', group: 'Sponsorship', purposes: ['data'] },
  { label: 'Standby Ads', value: 'user_sequences.standby', group: 'Sponsorship', purposes: ['data'] },
  { label: 'General Ads', value: 'user_sequences.general', group: 'Sponsorship', purposes: ['data'] },
];

/**
 * Look up an option by raw path value. Returns undefined if the value isn't
 * in the catalog (e.g. a custom hand-edited path). Caller should fall back
 * to displaying the raw value.
 */
export function findOption(value: string | undefined): PathOption | undefined {
  if (!value) return undefined;
  return DATA_PATH_OPTIONS.find(o => o.value === value);
}

/**
 * Group options for a given purpose, in the canonical group order. Each
 * group only appears if at least one of its options matches.
 */
export function groupedOptionsForPurpose(
  purpose: PathPurpose,
  opts: { includeSlotContext?: boolean } = {},
): { group: string; items: PathOption[] }[] {
  const filtered = DATA_PATH_OPTIONS.filter(o => {
    // 'condition' pickers can compare ANY game value (homeTeam.score,
    // setSlots.totalSets, booleans, ...), so the whole catalog qualifies.
    if (purpose !== 'condition' && !o.purposes.includes(purpose)) return false;
    if (o.slotContext && !opts.includeSlotContext) return false;
    return true;
  });

  const byGroup = new Map<string, PathOption[]>();
  filtered.forEach(o => {
    const existing = byGroup.get(o.group) || [];
    existing.push(o);
    byGroup.set(o.group, existing);
  });

  return GROUP_ORDER
    .filter(g => byGroup.has(g))
    .map(g => ({ group: g, items: byGroup.get(g)! }));
}
