// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Run `npm run sync-images` from the project root to regenerate
//
// Generated: 2026-02-23T15:48:29.025Z

// Available sports (auto-detected from folder structure)
export const AVAILABLE_SPORTS = ["Badminton","Baseball","Basketball","Clock","Countdown","Equestrian","Football","Generic","Hockey","InfoBoard","Lacrosse","Leaderboard","PlayerCard","PracticeTimer","Rugby","Sequence","Soccer","Tennis","Universal","Volleyball","Wrestling","break","fill","mocks","test_leaderboard"] as const;
export type Sport = typeof AVAILABLE_SPORTS[number];

// Sport data structure with subsections
export interface SportImageData {
  rootImages: string[];
  subsections: Record<string, string[]>;
  hasSubsections: boolean;
}

// Complete sport data with subsections
export const SPORT_IMAGE_DATA: Record<Sport, SportImageData> = {
  Badminton: {
    rootImages: ["bm-sb-minimized-frames.png","bm-sb-scorebug-frames.png","bm-sb-stadium-frames.png","bm-sb-standard-frames.png"],
    subsections: {"Compressed":["bm-compressed-base.png"],"Condensed":["bm-condensed-frames.png"],"Full":["bm-full-period-bg.png"],"ScorebugWide":["bm-scorebug-wide-set-overlay.jpg"]},
    hasSubsections: true,
  },
  Baseball: {
    rootImages: [],
    subsections: {"Condensed":["bs-condensed-base.png","bs-condensed-score-mask.png","bs-condensed-team-color-mask-bottom.png","bs-condensed-team-color-mask-top.png","bs-inning-marker-bottom.png","bs-inning-marker-top.png"],"Count":["balls_strikes_outs-node-basic_view.png","balls_strikes_outs-node.png","base-sb-minimized-diamond-gray.png","base-sb-minimized-diamond-highlight.png","WideBases/bs-count-wide-bases-base.png","WideBases/bs-wide-bases-diamond-gray.png","WideBases/bs-wide-bases-diamond-highlight.png"],"LineScore":["current-inning-marker.png","inning-marker.png","main-scoreboard-node.png","team-color-mask.png"],"LineScoreCompressed":["bs-line-score-compressed-base.png","bs-team-color-mask-bottom.png","bs-team-color-mask-top.png"],"Lineup":["field-node-positions-base.png","field-node-positions-color-mask.png","field-node.png","team-lineup-team-color-mask.png","team-linup-node.png"],"LineupMinimized":["bs-lineup-list-minimized-base.png","bs-lineup-list-minimized-color-mask.png"],"PitchSpeed":["mph_base.png"],"TeamMatchup":["team-matchup-bg.png"]},
    hasSubsections: true,
  },
  Basketball: {
    rootImages: [],
    subsections: {"Compressed":["_Timeouts/bb-compressed-timeout-l-off.png","_Timeouts/bb-compressed-timeout-l.png","_Timeouts/bb-compressed-timeout-m-off.png","_Timeouts/bb-compressed-timeout-m.png","_Timeouts/bb-compressed-timeout-r-off.png","_Timeouts/bb-compressed-timeout-r.png","bb-compressed-base.png","bb-compressed-bonus-off.png","bb-compressed-bonus-on.png","bb-compressed-overtime-overlay.png","bb-compressed-possesion-arrow-left.png","bb-compressed-possesion-arrow-right.png","bb-compressed-score-mask-left.png","bb-compressed-score-mask-right.png","bb-compressed-stopped-clock.png","bb-compressed-team-mask-left.png","bb-compressed-team-mask-right.png"],"Condensed":["bb-condensed-arrow-bottom.png","bb-condensed-arrow-top.png","bb-condensed-frames.png","bb-condensed-h1-off.png","bb-condensed-h1-on.png","bb-condensed-h2-off.png","bb-condensed-h2-on.png","bb-condensed-logo-mask.png","bb-condensed-overtime-overlay.png","bb-condensed-p1-off.png","bb-condensed-p1-on.png","bb-condensed-p2-off.png","bb-condensed-p2-on.png","bb-condensed-p3-off.png","bb-condensed-p3-on.png","bb-condensed-p4-off.png","bb-condensed-p4-on.png","bb-condensed-score-mask.png","bb-condensed-team-color-bottom.png","bb-condensed-team-color-top.png","condensed-clock-stopped.png"],"Countdown":["_Timeouts/bb-countdown-timeout-l-off.png","_Timeouts/bb-countdown-timeout-l-on.png","_Timeouts/bb-countdown-timeout-m-off.png","_Timeouts/bb-countdown-timeout-m-on.png","_Timeouts/bb-countdown-timeout-r-off.png","_Timeouts/bb-countdown-timeout-r-on.png","_Timeouts/timeout-light-off.png","_Timeouts/timeout-light-on.png","bb-countdown-base.png","bb-countdown-score-mask.png","bb-countdown-team-color-left.png","bb-countdown-team-color-right.png","bb-countdown-team-logo-mask.png"],"Full":["_Timeouts/bb-full-timeout-l-off.png","_Timeouts/bb-full-timeout-l-on.png","_Timeouts/bb-full-timeout-m-off.png","_Timeouts/bb-full-timeout-m-on.png","_Timeouts/bb-full-timeout-r-off.png","_Timeouts/bb-full-timeout-r-on.png","bb-full-arrow-left.png","bb-full-arrow-right.png","bb-full-bonus-l-b-off.png","bb-full-bonus-l-b-on.png","bb-full-bonus-l-t-off.png","bb-full-bonus-l-t-on.png","bb-full-bonus-r-b-off.png","bb-full-bonus-r-b-on.png","bb-full-bonus-r-t-off.png","bb-full-bonus-r-t-on.png","bb-full-clock-bg.png","bb-full-clock-stopped.png","bb-full-frames.png","bb-full-overtime-bg.png","bb-full-period-bg.png","bb-full-score-mask-left.png","bb-full-score-mask-right.png","bb-full-team-color-left.png","bb-full-team-color-right.png"],"FullSmall":["bb-full-small-base.png","bb-full-small-bonus-off.png","bb-full-small-bonus-on.png","bb-full-small-clock-base.png","bb-full-small-overtime-overlay.png","bb-full-small-score-mask-left.png","bb-full-small-score-mask-right.png","bb-full-small-stopped-clock.png","bb-full-small-team-mask-left.png","bb-full-small-team-mask-right.png"],"FullTall":["_Timeouts/bb-full-tall-timeout-l-off.png","_Timeouts/bb-full-tall-timeout-l-on.png","_Timeouts/bb-full-tall-timeout-m-off.png","_Timeouts/bb-full-tall-timeout-m-on.png","_Timeouts/bb-full-tall-timeout-r-off.png","_Timeouts/bb-full-tall-timeout-r-on.png","bb-full-tall-arrow-left.png","bb-full-tall-arrow-right.png","bb-full-tall-bonus-l-b-off.png","bb-full-tall-bonus-l-b-on.png","bb-full-tall-bonus-l-t-off.png","bb-full-tall-bonus-l-t-on.png","bb-full-tall-bonus-r-b-off.png","bb-full-tall-bonus-r-b-on.png","bb-full-tall-bonus-r-t-off.png","bb-full-tall-bonus-r-t-on.png","bb-full-tall-clock-bg.png","bb-full-tall-clock-stopped.png","bb-full-tall-frame.png","bb-full-tall-overtime-bg.png","bb-full-tall-period-bg.png","bb-full-tall-score-mask-left.png","bb-full-tall-score-mask-right.png","bb-full-tall-team-color-left.png","bb-full-tall-team-color-right.png"],"FullWide":["_Timeouts/bb-full-small-timeout-l-off.png","_Timeouts/bb-full-small-timeout-l-on.png","_Timeouts/bb-full-small-timeout-m-off.png","_Timeouts/bb-full-small-timeout-m-on.png","_Timeouts/bb-full-small-timeout-r-off.png","_Timeouts/bb-full-small-timeout-r-on.png","bb-full-small-base.png","bb-full-small-bonus-off.png","bb-full-small-bonus-on.png","bb-full-small-clock-base.png","bb-full-small-clock-stopped.png","bb-full-small-overtime-overlay.png","bb-full-small-score-mask-left.png","bb-full-small-score-mask-right.png","bb-full-small-team-mask-left.png","bb-full-small-team-mask-right.png","bb-full-wide-hide-clock-possession-base.png","bb-full-wide-hide-clock-possession-left.png","bb-full-wide-hide-clock-possession-right.png","bb-full-wide-possession-left.png","bb-full-wide-possession-right.png"],"Scorebug":["bb-sb-scorebug-arrow-left.png","bb-sb-scorebug-arrow-right.png","bb-sb-scorebug-clock-stopped.png","bb-sb-scorebug-frames.png","bb-sb-scorebug-period-1.png","bb-sb-scorebug-period-2.png","bb-sb-scorebug-period-3.png","bb-sb-scorebug-period-4.png","bb-sb-scorebug-period-ot.png","bb-sb-scorebug-score-mask-left.png","bb-sb-scorebug-score-mask-right.png","bb-sb-scorebug-team-color-left.png","bb-sb-scorebug-team-color-right.png"],"ScorebugFull":["bb-sb-scorebug-full-arrow-left-off.png","bb-sb-scorebug-full-arrow-left-on.png","bb-sb-scorebug-full-arrow-right-off.png","bb-sb-scorebug-full-arrow-right-on.png","bb-sb-scorebug-full-color-mask-left.png","bb-sb-scorebug-full-color-mask-right.png","bb-sb-scorebug-full-frames.png","bb-sb-scorebug-full-period-1.png","bb-sb-scorebug-full-period-2.png","bb-sb-scorebug-full-period-3.png","bb-sb-scorebug-full-period-4.png","bb-sb-scorebug-full-period-bg.png","bb-sb-scorebug-full-score-mask.png","bb-sb-scorebug-full-timer-bg.png"],"ScorebugLarge":["bb-sb-scorebug-lg-away-color-mask.png","bb-sb-scorebug-lg-away-score-mask.png","bb-sb-scorebug-lg-clock-stopped.png","bb-sb-scorebug-lg-frames.png","bb-sb-scorebug-lg-home-color-mask.png","bb-sb-scorebug-lg-home-score-mask.png","bb-sb-scorebug-lg-overtime.png","bb-sb-scorebug-lg-possession-left.png","bb-sb-scorebug-lg-possession-right.png","bb-sb-scorebug-lg-sudden-death.png","Bonus/bb-sb-scorebug-lg-bonus-lb-on.png","Bonus/bb-sb-scorebug-lg-bonus-lb.png","Bonus/bb-sb-scorebug-lg-bonus-lt-on.png","Bonus/bb-sb-scorebug-lg-bonus-lt.png","Bonus/bb-sb-scorebug-lg-bonus-rb-on.png","Bonus/bb-sb-scorebug-lg-bonus-rb.png","Bonus/bb-sb-scorebug-lg-bonus-rt-on.png","Bonus/bb-sb-scorebug-lg-bonus-rt.png","TimeoutStrip/bb-sb-scorebug-lg-timeout-l-off.png","TimeoutStrip/bb-sb-scorebug-lg-timeout-l-on.png","TimeoutStrip/bb-sb-scorebug-lg-timeout-m-off.png","TimeoutStrip/bb-sb-scorebug-lg-timeout-m-on.png","TimeoutStrip/bb-sb-scorebug-lg-timeout-r-off.png","TimeoutStrip/bb-sb-scorebug-lg-timeout-r-on.png"],"ScorebugWide":["bb-scorebug-wide-arrow-left.png","bb-scorebug-wide-arrow-right.png","bb-scorebug-wide-clock-stopped.png","bb-scorebug-wide-color-mask-left.png","bb-scorebug-wide-color-mask-right.png","bb-scorebug-wide-frames.png","bb-scorebug-wide-overtime-overlay.png","bb-scorebug-wide-score-mask.png","bb-scorebug-wide-wrapper-mask.png"],"Strip":["bb-strip-base.png","bb-strip-clock-stopped.png","bb-strip-left-color-mask.png","bb-strip-right-color-mask.png","bb-strip-score-mask.png","bb-strip-time-base.png"],"_Legacy_Minimized":["bb-sb-condensed-bonus-l-b-off.png","bb-sb-condensed-bonus-l-b-on.png","bb-sb-condensed-bonus-l-t-off.png","bb-sb-condensed-bonus-l-t-on.png","bb-sb-condensed-bonus-r-b-off.png","bb-sb-condensed-bonus-r-b-on.png","bb-sb-condensed-bonus-r-t-off.png","bb-sb-condensed-bonus-r-t-on.png","bb-sb-condensed-clock-stopped.png","bb-sb-condensed-frames.png","bb-sb-condensed-halves-1-on.png","bb-sb-condensed-halves-2-on.png","bb-sb-condensed-halves-base.png","bb-sb-condensed-overtime.png","bb-sb-condensed-periods-1-on.png","bb-sb-condensed-periods-2-on.png","bb-sb-condensed-periods-3-on.png","bb-sb-condensed-periods-4-on.png","bb-sb-condensed-periods-base.png","bb-sb-condensed-score-mask.png","bb-sb-condensed-sudden-death.png","bb-sb-condensed-team-color-left.png","bb-sb-condensed-team-color-right.png","bb-sb-minimized-videosb-poss-base.png","bb-sb-minimized-videosb-poss-left.png","bb-sb-minimized-videosb-poss-right.png"],"_Legacy_Standard":["bb-sb-standard-arrow-left.png","bb-sb-standard-arrow-right.png","bb-sb-standard-bonus-l-b-off.png","bb-sb-standard-bonus-l-b-on.png","bb-sb-standard-bonus-l-t-off.png","bb-sb-standard-bonus-l-t-on.png","bb-sb-standard-bonus-r-b-off.png","bb-sb-standard-bonus-r-b-on.png","bb-sb-standard-bonus-r-t-off.png","bb-sb-standard-bonus-r-t-on.png","bb-sb-standard-clock-bg.png","bb-sb-standard-clock-stopped.png","bb-sb-standard-frames.png","bb-sb-standard-overtime-bg.png","bb-sb-standard-period-bg.png","bb-sb-standard-score-mask-left.png","bb-sb-standard-score-mask-right.png","bb-sb-standard-team-color-left.png","bb-sb-standard-team-color-right.png"],"_Legacy_Strip":["bb-sb-strip-clock-bg.png","bb-sb-strip-clock-stopped.png","bb-sb-strip-frames.png","bb-sb-strip-score-mask.png","bb-sb-strip-team-color-left.png","bb-sb-strip-team-color-right.png"]},
    hasSubsections: true,
  },
  Clock: {
    rootImages: ["base-sb-clock-stopped.png","clock-node.png"],
    subsections: {},
    hasSubsections: false,
  },
  Countdown: {
    rootImages: [],
    subsections: {"BasketballMinimized":["bb-cd-minimized-halftime-overlay.png","bb-cd-minimized-period-break-overlay.png","bb-cd-minimized-pregame-overlay.png","bb-cd-minimized-timeout-clock-overlay.png","bb-cd-minimized-timeout-overlay.png"],"BasketballScorebug":["bb-cd-full-halftime-overlay.png","bb-cd-full-period-break-overlay.png","bb-cd-full-pregame-overlay.png","bb-cd-full-tab.png","bb-cd-full-timeout-overlay.png"],"BasketballStadium":["cd-minimized-tab-skinny.png","stadium-countdown-crop.png"],"Compressed":["cd-compressed-base.png","cd-compressed-color-mask-left.png","cd-compressed-color-mask-right.png","cd-compressed-logo-mask-left.png","cd-compressed-logo-mask-right.png","cd-compressed-score-mask-left.png","cd-compressed-score-mask-right.png"],"FullWide":["cd-full-wide-base-halftime.png","cd-full-wide-base-period-break.png","cd-full-wide-base-pre-game.png","cd-full-wide-base-timeout.png","cd-full-wide-clock-base.png","cd-full-wide-clock-stopped.png","cd-full-wide-score-mask-left.png","cd-full-wide-score-mask-right.png","cd-full-wide-team-mask-left.png","cd-full-wide-team-mask-right.png"],"Large":["cd-large-away-color-mask.png","cd-large-base.png","cd-large-break-overlay.png","cd-large-halftime-overlay.png","cd-large-home-color-mask.png","cd-large-pregame-overlay.png","cd-large-score-mask.png","cd-large-stopped-clock.png","cd-large-timeout-clock.png","cd-large-timeout-overlay.png"],"Minimized":["cd-minimized-frames.png","cd-minimized-halftime.png","cd-minimized-period-break.png","cd-minimized-pre-game.png","cd-minimized-tab.png","cd-minimized-timeout.png"],"OutdoorStadium":["cd-outdoor-stadium-halftime-base.png","cd-outdoor-stadium-period-break-base.png","cd-outdoor-stadium-pre-game-base.png","cd-outdoor-stadium-timeout-base.png","cd-outdoor-stadium-timer-bg.png"],"Standard":["bb-sb-countdown-clock-bg.png","bb-sb-countdown-clock-stopped.png","bb-sb-countdown-frames.png","bb-sb-countdown-score-mask.png","bb-sb-countdown-team-color-left.png","bb-sb-countdown-team-color-right.png","cd-standard-ind-break.png","cd-standard-ind-halftime.png","cd-standard-ind-pregame.png","cd-standard-ind-timeout.png","cd-standard-vs.png"],"Strip":["cd-strip-clock-base.png","cd-strip-clock-stopped.png","cd-strip-title-halftime.png","cd-strip-title-period-break.png","cd-strip-title-pre-game.png","cd-strip-title-timeout.png"],"VolleyballScorebug":["vb-cd-scorebug-period-break-overlay.png","vb-cd-scorebug-pre-game-overlay.png","vb-cd-scorebug-timeout-overlay.png"]},
    hasSubsections: true,
  },
  Equestrian: {
    rootImages: [],
    subsections: {"ActiveRiderNode":["base-away.png","base-home.png","eg-player-card-away-rider-number-mask.png","eg-player-card-away-rider-number.png","eg-player-card-home-rider-number-mask.png","eg-player-card-home-rider-number.png","eq-player-card-away-base-mop.png","eq-player-card-away-base.png","eq-player-card-eof-header.png","eq-player-card-eotf-header.png","eq-player-card-h-header.png","eq-player-card-home-base-mop.png","eq-player-card-home-base.png","eq-player-card-mop-away-color-mask.png","eq-player-card-mop-away-label.png","eq-player-card-mop-home-color-mask.png","eq-player-card-mop-home-label.png","eq-player-card-r-header.png","eq-player-card-team-color-mask.png"],"ActiveRiderOverlay":["eq_champ_away_rider_marker.png","eq_champ_home_rider_marker.png","eq-active-away-rider-marker.png","eq-active-home-rider-marker.png"],"Header":["eq-eof-header.png","eq-eotf-header.png","eq-h-header.png","eq-r-header.png"],"Media":["eq-media-base-cropped.png","eq-media-base-full.png"],"PlayerScores":["eq_champ_away_color_mask.png","eq_champ_base.png","eq_champ_home_color_mask.png","eq-away-color-mask.png","eq-base.png","eq-home-color-mask.png","eq-rider-marker.png"],"TeamNames":["eq-team-names-away-color-mask.png","eq-team-names-base.png","eq-team-names-home-color-mask.png"],"TeamScores":["eq-team-score-base.png","eq-team-score-color-mask.png","eq-team-score-header.png","eq-team-score-total-base.png"]},
    hasSubsections: true,
  },
  Football: {
    rootImages: [],
    subsections: {"Minimized":["fb-sb-minimized-clock-stopped.png","fb-sb-minimized-college-overtime.png","fb-sb-minimized-frames.png","fb-sb-minimized-quarter-1-off.png","fb-sb-minimized-quarter-1-on.png","fb-sb-minimized-quarter-2-off.png","fb-sb-minimized-quarter-2-on.png","fb-sb-minimized-quarter-3-off.png","fb-sb-minimized-quarter-3-on.png","fb-sb-minimized-quarter-4-off.png","fb-sb-minimized-quarter-4-on.png","fb-sb-minimized-score-masks.png","fb-sb-minimized-team-color-left.png","fb-sb-minimized-team-color-right.png"],"Scorebug":["fb-scorebug-away-color-mask.png","fb-scorebug-base-overtime.png","fb-scorebug-base.png","fb-scorebug-clock-stopped.png","fb-scorebug-home-color-mask.png","fb-scorebug-score-mask-away.png","fb-scorebug-score-mask-home.png"],"Simple":["fb-simple-away-score-animation-mask.png","fb-simple-away-team-color-mask.png","fb-simple-base.png","fb-simple-clock-stopped.png","fb-simple-halftime-overlay.png","fb-simple-home-color-mask.png","fb-simple-home-score-animation-mask.png","fb-simple-left-arrow.png","fb-simple-pregame-overlay.png","fb-simple-preiod-break_overlay.png","fb-simple-right-arrow.png","fb-simple-timeout-overlay.png","Timeouts/fb-simple-timeout-l-off.png","Timeouts/fb-simple-timeout-l-on.png","Timeouts/fb-simple-timeout-m-off.png","Timeouts/fb-simple-timeout-m-on.png","Timeouts/fb-simple-timeout-r-off.png","Timeouts/fb-simple-timeout-r-on.png"],"Stadium":["_Timeouts/fb-sb-stadium-timeout-l-off.png","_Timeouts/fb-sb-stadium-timeout-l-on.png","_Timeouts/fb-sb-stadium-timeout-m-off.png","_Timeouts/fb-sb-stadium-timeout-m-on.png","_Timeouts/fb-sb-stadium-timeout-r-off.png","_Timeouts/fb-sb-stadium-timeout-r-on.png","fb-sb-stadium-clock-stopped.png","fb-sb-stadium-college-overtime.png","fb-sb-stadium-color-mask-left.png","fb-sb-stadium-color-mask-right.png","fb-sb-stadium-frames.png","fb-sb-stadium-possession-left.png","fb-sb-stadium-possession-right.png","fb-sb-stadium-quarter-1.png","fb-sb-stadium-quarter-2.png","fb-sb-stadium-quarter-3.png","fb-sb-stadium-quarter-4.png","fb-sb-stadium-quarter-overtime.png","fb-sb-stadium-score-mask-left.png","fb-sb-stadium-score-mask-right.png"],"Stadium Wide":["fb-sb-stadium-bin-cap-left.png","fb-sb-stadium-bin-cap-right.png","fb-sb-stadium-clock-stopped.png","fb-sb-stadium-color-mask-left.png","fb-sb-stadium-color-mask-right.png","fb-sb-stadium-frames.png","fb-sb-stadium-possession-left.png","fb-sb-stadium-possession-right.png","fb-sb-stadium-quarter-1.png","fb-sb-stadium-quarter-2.png","fb-sb-stadium-quarter-3.png","fb-sb-stadium-quarter-4.png","fb-sb-stadium-quarter-overtime.png","fb-sb-stadium-score-mask-left.png","fb-sb-stadium-score-mask-right.png"],"Standard":["_Timeouts/fb-standard-timeout-l-off.png","_Timeouts/fb-standard-timeout-l-on.png","_Timeouts/fb-standard-timeout-m-off.png","_Timeouts/fb-standard-timeout-m-on.png","_Timeouts/fb-standard-timeout-r-off.png","_Timeouts/fb-standard-timeout-r-on.png","fb-sb-standard-clock-bg.png","fb-sb-standard-clock-stopped.png","fb-sb-standard-down-1.png","fb-sb-standard-down-2.png","fb-sb-standard-down-3.png","fb-sb-standard-down-4.png","fb-sb-standard-frames.png","fb-sb-standard-points-mask-left.png","fb-sb-standard-points-mask-right.png","fb-sb-standard-possession-left.png","fb-sb-standard-possession-right.png","fb-sb-standard-team-color-left.png","fb-sb-standard-team-color-right.png","fb-standard-base-overtime.png"],"StandardTall":["fb-standard-tall-base.png","fb-standard-tall-clock-bg.png","fb-standard-tall-clock-stopped.png","fb-standard-tall-college-overtime.png","fb-standard-tall-down-1.png","fb-standard-tall-down-2.png","fb-standard-tall-down-3.png","fb-standard-tall-down-4.png","fb-standard-tall-overtime.png","fb-standard-tall-possession-left.png","fb-standard-tall-possession-right.png","fb-standard-tall-score-mask-left.png","fb-standard-tall-score-mask-right.png","fb-standard-tall-team-color-left.png","fb-standard-tall-team-color-right.png"],"StreamBug":["football-stream-bug-base.png","football-stream-bug-color-mask-left.png","football-stream-bug-color-mask-right.png","football-stream-bug-down-1.png","football-stream-bug-down-2.png","football-stream-bug-down-3.png","football-stream-bug-down-4.png","football-stream-bug-possession-left.png","football-stream-bug-possession-right.png"]},
    hasSubsections: true,
  },
  Generic: {
    rootImages: [],
    subsections: {"Countdown":["generic-countdown-base.png","generic-countdown-score-mask.png","generic-countdown-team-color-left.png","generic-countdown-team-color-right.png","generic-countdown-vs-overlay.png"],"Simple":["fb-simple-away-score-animation-mask.png","fb-simple-clock-stopped.png","fb-simple-halftime-overlay.png","fb-simple-home-score-animation-mask.png","fb-simple-left-arrow.png","fb-simple-pregame-overlay.png","fb-simple-preiod-break_overlay.png","fb-simple-right-arrow.png","fb-simple-timeout-overlay.png","generic-simple-away-color-mask-soccer.png","generic-simple-base-soccer.png","generic-simple-home-color-mask-soccer.png"],"StreamBug":["_Timeouts/generic-stream-bug-timeout-l-off.png","_Timeouts/generic-stream-bug-timeout-l-on.png","_Timeouts/generic-stream-bug-timeout-m-off.png","_Timeouts/generic-stream-bug-timeout-m-on.png","_Timeouts/generic-stream-bug-timeout-orange-l-off.png","_Timeouts/generic-stream-bug-timeout-orange-l-on.png","_Timeouts/generic-stream-bug-timeout-orange-m-off.png","_Timeouts/generic-stream-bug-timeout-orange-m-on.png","_Timeouts/generic-stream-bug-timeout-orange-r-off.png","_Timeouts/generic-stream-bug-timeout-orange-r-on.png","_Timeouts/generic-stream-bug-timeout-r-off.png","_Timeouts/generic-stream-bug-timeout-r-on.png","generic-stream-bug-base.png","generic-stream-bug-color-mask-left.png","generic-stream-bug-color-mask-right.png"],"StreamBugCondensed":["_Timeouts/generic-stream-bug-condensed-timeout-l-off.png","_Timeouts/generic-stream-bug-condensed-timeout-l-on.png","_Timeouts/generic-stream-bug-condensed-timeout-m-off.png","_Timeouts/generic-stream-bug-condensed-timeout-m-on.png","_Timeouts/generic-stream-bug-condensed-timeout-r-off.png","_Timeouts/generic-stream-bug-condensed-timeout-r-on.png","generic-stream-bug-condensed-base.png","generic-stream-bug-condensed-color-mask-left.png","generic-stream-bug-condensed-color-mask-right.png"],"Utility":["16x9-cd-clock-stopped.png","16x9-cd-ind-break.png","16x9-cd-ind-halftime.png","16x9-cd-ind-pregame.png","16x9-cd-ind-timeout.png","16x9-cd-score-base.png","16x9-cd-team-color-border.png","16x9-cd-team-color-mask.png","16x9-cd-ticker-bg.png","16x9-cd-time-base.png","16x9-cd-time-tab.png","background_test.jpeg","cd-standard-vs.png"]},
    hasSubsections: true,
  },
  Hockey: {
    rootImages: [],
    subsections: {"Compressed":["ho-compressed-base.png","ho-compressed-clock-stopped.png","ho-compressed-logo-mask-left.png","ho-compressed-logo-mask-right.png","ho-compressed-overtime-overlay.png","ho-compressed-penalty-left-off.png","ho-compressed-penalty-left-on.png","ho-compressed-penalty-off.png","ho-compressed-penalty-on.png","ho-compressed-penalty-right-off.png","ho-compressed-penalty-right-on.png","ho-compressed-score-mask-left.png","ho-compressed-score-mask-right.png","ho-compressed-shootout-overlay.png"],"Condensed":["condensed-clock-stopped.png","ho-condensed-frames.png","ho-condensed-logo-mask.png","ho-condensed-p1-off.png","ho-condensed-p1-on.png","ho-condensed-p2-off.png","ho-condensed-p2-on.png","ho-condensed-p3-off.png","ho-condensed-p3-on.png","ho-condensed-score-mask.png","ho-condensed-shootout-overlay.png","ho-condensed-team-color-bottom.png","ho-condensed-team-color-top.png"],"Full":["ho-full-clock-base.png","ho-full-frames.png","ho-full-penalty-color-mask-left-1.png","ho-full-penalty-color-mask-left-2.png","ho-full-penalty-color-mask-right-1.png","ho-full-penalty-color-mask-right-2.png","ho-full-penalty-slider-left-1.png","ho-full-penalty-slider-left-2.png","ho-full-penalty-slider-left.png","ho-full-penalty-slider-right-1.png","ho-full-penalty-slider-right-2.png","ho-full-penalty-slider-right.png","ho-full-score-mask.png","ho-full-sog-tol-left.png","ho-full-sog-tol-right.png","ho-full-stopped-clock.png","ho-full-team-color-left.png","ho-full-team-color-right.png"],"Scorebug":["sscorebug_shooutout_overlay.png"]},
    hasSubsections: true,
  },
  InfoBoard: {
    rootImages: ["16-team-bracket-base.png","4-team-bracket-base.png","8-team-bracket-base.png"],
    subsections: {},
    hasSubsections: false,
  },
  Lacrosse: {
    rootImages: [],
    subsections: {"Compressed":["_Timeouts/lc-compressed-timeout-l-off.png","_Timeouts/lc-compressed-timeout-l-on.png","_Timeouts/lc-compressed-timeout-m-off.png","_Timeouts/lc-compressed-timeout-m-on.png","_Timeouts/lc-compressed-timeout-r-off.png","_Timeouts/lc-compressed-timeout-r-on.png","lc-compressed-base.png","lc-compressed-clock-stopped.png","lc-compressed-score-mask-left.png","lc-compressed-score-mask-right.png","lc-compressed-shootout-overlay.png","lc-compressed-team-color-left.png","lc-compressed-team-color-right.png","lc-compressed-team-mask-left.png","lc-compressed-team-mask-right.png"],"CompressedTall":["_Timeouts/lc-stadium-timeout-l-off.png","_Timeouts/lc-stadium-timeout-l-on.png","_Timeouts/lc-stadium-timeout-m-off.png","_Timeouts/lc-stadium-timeout-m-on.png","_Timeouts/lc-stadium-timeout-r-off.png","_Timeouts/lc-stadium-timeout-r-on.png","lc-stadium-base.png","lc-stadium-clock-stopped.png","lc-stadium-logo-mask-left.png","lc-stadium-logo-mask-right.png","lc-stadium-overtime.png","lc-stadium-score-mask-left.png","lc-stadium-score-mask-right.png","lc-stadium-team-color-left.png","lc-stadium-team-color-right.png"],"Condensed":["_Timeouts/lc-condensed-timeout-l-off.png","_Timeouts/lc-condensed-timeout-l-on.png","_Timeouts/lc-condensed-timeout-leftcurve-off.png","_Timeouts/lc-condensed-timeout-leftcurve-on.png","_Timeouts/lc-condensed-timeout-leftedge-off.png","_Timeouts/lc-condensed-timeout-leftedge-on.png","_Timeouts/lc-condensed-timeout-m-off.png","_Timeouts/lc-condensed-timeout-m-on.png","_Timeouts/lc-condensed-timeout-r-off.png","_Timeouts/lc-condensed-timeout-r-on.png","_Timeouts/lc-condensed-timeout-rightcurve-off.png","_Timeouts/lc-condensed-timeout-rightcurve-on.png","_Timeouts/lc-condensed-timeout-rightedge-off.png","_Timeouts/lc-condensed-timeout-rightedge-on.png","lc-condensed-base.png","lc-condensed-clock-stopped.png","lc-condensed-left-team-color.png","lc-condensed-overtime-1-off.png","lc-condensed-overtime-1-on.png","lc-condensed-overtime-2-off.png","lc-condensed-overtime-2-on.png","lc-condensed-period-1-off.png","lc-condensed-period-1-on.png","lc-condensed-period-2-off.png","lc-condensed-period-2-on.png","lc-condensed-period-3-off.png","lc-condensed-period-3-on.png","lc-condensed-period-4-off.png","lc-condensed-period-4-on.png","lc-condensed-right-team-color.png","lc-condensed-score-mask.png"],"Full":["_Timeouts/lc-standard-timeout-off-l.png","_Timeouts/lc-standard-timeout-off-m.png","_Timeouts/lc-standard-timeout-off-r.png","_Timeouts/lc-standard-timeout-on-l.png","_Timeouts/lc-standard-timeout-on-m.png","_Timeouts/lc-standard-timeout-on-r.png","lc-standard-base.png","lc-standard-clock-base.png","lc-standard-overtime-overlay.png","lc-standard-penalty-base-left-1.png","lc-standard-penalty-base-left-2.png","lc-standard-penalty-base-left-3.png","lc-standard-penalty-base-left.png","lc-standard-penalty-base-right-1.png","lc-standard-penalty-base-right-2.png","lc-standard-penalty-base-right-3.png","lc-standard-penalty-base-right.png","lc-standard-penalty-color-left-1.png","lc-standard-penalty-color-left-2.png","lc-standard-penalty-color-left-3.png","lc-standard-penalty-color-mask.png","lc-standard-penalty-color-right-1.png","lc-standard-penalty-color-right-2.png","lc-standard-penalty-color-right-3.png","lc-standard-score-mask.png","lc-standard-shots-saves-left.png","lc-standard-shots-saves-right.png","lc-standard-stopped-clock.png","lc-standard-team-color-left.png","lc-standard-team-color-right.png"],"FullWide":["lc-full-wide-base.png","lc-full-wide-clock-base.png","lc-full-wide-clock-stopped.png","lc-full-wide-overtime-overlay.png","lc-full-wide-penalty-base-left-1.png","lc-full-wide-penalty-base-left-2.png","lc-full-wide-penalty-base-left-3.png","lc-full-wide-penalty-base-left.png","lc-full-wide-penalty-base-right-1.png","lc-full-wide-penalty-base-right-2.png","lc-full-wide-penalty-base-right-3.png","lc-full-wide-penalty-base-right.png","lc-full-wide-penalty-color-left-1.png","lc-full-wide-penalty-color-left-2.png","lc-full-wide-penalty-color-left-3.png","lc-full-wide-penalty-color-right-1.png","lc-full-wide-penalty-color-right-2.png","lc-full-wide-penalty-color-right-3.png","lc-full-wide-score-mask.png","lc-full-wide-shots-saves-left.png","lc-full-wide-shots-saves-right.png","lc-full-wide-team-color-left.png","lc-full-wide-team-color-right.png"]},
    hasSubsections: true,
  },
  Leaderboard: {
    rootImages: [],
    subsections: {"Basketball":["Bare/bb-lb-bare-highlight-marker.png","Bare/bb-lb-bare-left-base.png","Bare/bb-lb-bare-left-row-base.png","Bare/bb-lb-bare-left-row-color-mask.png","Bare/bb-lb-bare-right-base.png","Bare/bb-lb-bare-right-row-base.png","Bare/bb-lb-bare-right-row-color-mask.png","Split/bb-lb-split-highlight-marker.png","Split/bb-lb-split-left-base-players-only.png","Split/bb-lb-split-left-base.png","Split/bb-lb-split-left-points-fouls-labels.png","Split/bb-lb-split-left-row-base.png","Split/bb-lb-split-left-row-color-mask.png","Split/bb-lb-split-lefts-ponts-fouls-color-masks.png","Split/bb-lb-split-right-base-players-only.png","Split/bb-lb-split-right-base.png","Split/bb-lb-split-right-points-fouls-labels.png","Split/bb-lb-split-right-ponts-fouls-color-masks.png","Split/bb-lb-split-right-row-base.png","Split/bb-lb-split-right-row-color-mask.png","Standard/bb-lb-standard-left-arrow-base.png","Standard/bb-lb-standard-left-arrow-color-mask.png","Standard/bb-lb-standard-left-base.png","Standard/bb-lb-standard-left-color-mask.png","Standard/bb-lb-standard-left-highlighted-row.png","Standard/bb-lb-standard-left-player-name-color-mask.png","Standard/bb-lb-standard-left-row-highlight-indv.png","Standard/bb-lb-standard-left-row.png","Standard/bb-lb-standard-right-arrow-base.png","Standard/bb-lb-standard-right-arrow-color-mask.png","Standard/bb-lb-standard-right-base.png","Standard/bb-lb-standard-right-color-mask.png","Standard/bb-lb-standard-right-highlighted-row.png","Standard/bb-lb-standard-right-player-name-color-mask.png","Standard/bb-lb-standard-right-row-highlight-indv.png","Standard/bb-lb-standard-right-row.png","Standard/bb-lb-standard-stat-highlight.png"],"Volleyball":["SingleTeam/vb-lb-singleteam-akb.png","SingleTeam/vb-lb-singleteam-player-border.png","SingleTeam/vb-lb-singleteam-player-mask.png","SingleTeam/vb-lb-singleteam-row-base-highlight-indv.png","SingleTeam/vb-lb-singleteam-row-base.png","Split/vb-lb-split-left-base.png","Split/vb-lb-split-left-color-mask.png","Split/vb-lb-split-left-row-color-mask.png","Split/vb-lb-split-left-row.png","Split/vb-lb-split-right-base.png","Split/vb-lb-split-right-color-mask.png","Split/vb-lb-split-right-row-color-mask.png","Split/vb-lb-split-right-row.png","Split/vb-lb-split-stat-highlight.png","SplitDigs/vb-lb-splitdigs-left-base.png","SplitDigs/vb-lb-splitdigs-left-row-color-mask.png","SplitDigs/vb-lb-splitdigs-left-row.png","SplitDigs/vb-lb-splitdigs-right-base.png","SplitDigs/vb-lb-splitdigs-right-row-color-mask.png","SplitDigs/vb-lb-splitdigs-right-row.png","SplitDigs/vb-lb-splitdigs-stat-highlight.png","SplitPlayersOnly/vb-lb-split-players-only-left-base.png","SplitPlayersOnly/vb-lb-split-players-only-right-base.png","Standard/vb-lb-standard-left-arrow-base.png","Standard/vb-lb-standard-left-arrow-color-mask.png","Standard/vb-lb-standard-left-base.png","Standard/vb-lb-standard-left-color-mask.png","Standard/vb-lb-standard-left-highlighted-row.png","Standard/vb-lb-standard-left-player-name-color-mask.png","Standard/vb-lb-standard-left-row-highlight-indv.png","Standard/vb-lb-standard-left-row.png","Standard/vb-lb-standard-right-arrow-base.png","Standard/vb-lb-standard-right-arrow-color-mask.png","Standard/vb-lb-standard-right-base.png","Standard/vb-lb-standard-right-color-mask.png","Standard/vb-lb-standard-right-highlighted-row.png","Standard/vb-lb-standard-right-player-name-color-mask.png","Standard/vb-lb-standard-right-row-highlight-indv.png","Standard/vb-lb-standard-right-row.png","Standard/vb-lb-standard-stat-highlight.png"]},
    hasSubsections: true,
  },
  PlayerCard: {
    rootImages: ["player-card-base.png","playercard-design-concept-2.png","playercard-design-concept.png"],
    subsections: {},
    hasSubsections: false,
  },
  PracticeTimer: {
    rootImages: [],
    subsections: {"Standard":["practice-timer-standard-base.png"],"StandardTall":["practice-timer-standard-tall-base.png"],"StandardTallDescription":["practice-timer-standard-tall-description-base.png"],"StandardWide":["practice-timer-standard-wide-base.png"]},
    hasSubsections: true,
  },
  Rugby: {
    rootImages: [],
    subsections: {"Compressed":["rb-compressed-base.png","rb-compressed-clock-stopped.png","rb-compressed-overtime-overlay.png","rb-compressed-score-mask-left.png","rb-compressed-score-mask-right.png","rb-compressed-team-color-left.png","rb-compressed-team-color-right.png","rb-compressed-team-mask-left.png","rb-compressed-team-mask-right.png"],"Minimized":["rb-sb-minimized-clock-stopped.png","rb-sb-minimized-frames.png","rb-sb-minimized-period-overtime.png","rb-sb-minimized-score-mask-left.png","rb-sb-minimized-score-mask-right.png","rb-sb-minimized-team-color-left.png","rb-sb-minimized-team-color-right.png"],"Stadium Wide":["rb-sb-stadium-wide-clock-stopped.png","rb-sb-stadium-wide-frames.png","rb-sb-stadium-wide-score-mask-left.png","rb-sb-stadium-wide-score-mask-right.png","rb-sb-stadium-wide-team-color-left.png","rb-sb-stadium-wide-team-color-right.png"]},
    hasSubsections: true,
  },
  Sequence: {
    rootImages: ["banner-mockup.png","block-mockup.png","cinema-mockup.png","double-block-mockup.png","panel-mockup.png","scorebug-framed-mockup.png","scorebug-mockup.png","sequence-scorebug-frames.png"],
    subsections: {},
    hasSubsections: false,
  },
  Soccer: {
    rootImages: ["large-scorebug.png"],
    subsections: {"Minimized":["sc-sb-minimized-base.png","sc-sb-minimized-clock-stopped.png","sc-sb-minimized-overtime-1.png","sc-sb-minimized-overtime-2.png","sc-sb-minimized-period-1-off.png","sc-sb-minimized-period-1-on.png","sc-sb-minimized-period-2-off.png","sc-sb-minimized-period-2-on.png","sc-sb-minimized-score-mask.png","sc-sb-minimized-shootout.png","sc-sb-minimized-team-color-left.png","sc-sb-minimized-team-color-right.png"],"Stadium":["sc-sb-stadium-base.png","sc-sb-stadium-clock-stopped.png","sc-sb-stadium-overtime-bg.png","sc-sb-stadium-score-mask-left.png","sc-sb-stadium-score-mask-right.png","sc-sb-stadium-shootout.png","sc-sb-stadium-team-color-left.png","sc-sb-stadium-team-color-right.png"],"Standard":["sc-sb-standard-base.png","sc-sb-standard-clock-bg.png","sc-sb-standard-clock-stopped.png","sc-sb-standard-overtime-bg.png","sc-sb-standard-period-bg.png","sc-sb-standard-score-mask-left.png","sc-sb-standard-score-mask-right.png","sc-sb-standard-shootout-base.png","sc-sb-standard-shootout-color-mask-left.png","sc-sb-standard-shootout-color-mask-right.png","sc-sb-standard-shootout-small-hex.png","sc-sb-standard-shootout-small-hexes.png","sc-sb-standard-team-color-left.png","sc-sb-standard-team-color-right.png"],"StandardTall":["sc-sb-standard-tall-clock-bg.png","sc-sb-standard-tall-clock-stopped.png","sc-sb-standard-tall-frames.png","sc-sb-standard-tall-overtime-bg.png","sc-sb-standard-tall-period-bg.png","sc-sb-standard-tall-score-mask-left.png","sc-sb-standard-tall-score-mask-right.png","sc-sb-standard-tall-shootout-base.png","sc-sb-standard-tall-shootout-color-mask-left.png","sc-sb-standard-tall-shootout-color-mask-right.png","sc-sb-standard-tall-shootout-small-hex.png","sc-sb-standard-tall-shootout-small-hexes.png","sc-sb-standard-tall-team-color-left.png","sc-sb-standard-tall-team-color-right.png"],"StandardWide":["sc-sb-standard-wide-clock-bg.png","sc-sb-standard-wide-clock-stopped.png","sc-sb-standard-wide-frames.png","sc-sb-standard-wide-overtime-bg.png","sc-sb-standard-wide-period-bg.png","sc-sb-standard-wide-score-mask-left.png","sc-sb-standard-wide-score-mask-right.png","sc-sb-standard-wide-shootout-bg.png","sc-sb-standard-wide-shootout-color-mask-left.png","sc-sb-standard-wide-shootout-color-mask-right.png","sc-sb-standard-wide-shootout-small-hex.png","sc-sb-standard-wide-shootout-small-hexes.png","sc-sb-standard-wide-team-color-left.png","sc-sb-standard-wide-team-color-right.png"]},
    hasSubsections: true,
  },
  Tennis: {
    rootImages: [],
    subsections: {"1 Court Layout":["1_court-away-color-mask.png","1_court-base.png","1_court-home-color-mask.png"],"2 Courts Layout":["2-courts-away-color-mask.png","2-courts-base.png","2-courts-home-color-mask.png"],"4 Courts Layout":["4-court-away-color-mask.png","4-court-base.png","4-court-home-color-mask.png"],"6 Courts Layout":["6-court-away-color-mask.png","6-court-base.png","6-court-home-color-mask.png"],"8 Courts Layout":["8-courts-away-color-mask.png","8-courts-base.png","8-courts-home-color-mask.png"],"Scorebug Layout":["scorebug-away-color-mask.png","scorebug-base-cropped.png","scorebug-home-color-mask.png"],"Team Scores Header Module":["header-module-away-color-mask.png","header-module-base.png","header-module-home-color-mask.png","tn-header-score-mask.png"],"Videoboard Layout":["videobaord-away-logo-color-mask.png","videobaord-away-name-color-mask.png","videobaord-base.png","videobaord-home-logo-color-mask.png","videobaord-home-name-color-mask.png"]},
    hasSubsections: true,
  },
  Universal: {
    rootImages: ["Full - Universal.png"],
    subsections: {"Minimized":["univ-sb-minimized-frames.png"],"Scorebug":["univ-sb-scorebug-period.png"],"ScorebugLarge":["away-logo-color-mask.png","bb-sb-scorebug-lg-frames.png","home-logo-color-mask.png"],"Stadium":["univ-sb-stadium-frames.png"],"Standard":["bb-sb-standard-frames-universal.png"]},
    hasSubsections: true,
  },
  Volleyball: {
    rootImages: [],
    subsections: {"Compressed":["vb-compressed-base.png"],"Condensed":["bb-condensed-logo-mask.png","vb-condensed-frames.png","vb-condensed-score-mask.png","vb-condensed-team-color-bottom.png","vb-condensed-team-color-top.png"],"Full":["vb-full-frames.png","vb-full-period-bg.png","vb-full-score-mask-left.png","vb-full-score-mask-right.png","vb-full-team-color-left.png","vb-full-team-color-right.png"],"FullTall":["bm-full-tall-period-bg.png","vb-full-tall-base.png","vb-full-tall-period-bg.png","vb-full-tall-score-mask-left.png","vb-full-tall-score-mask-right.png","vb-full-tall-team-color-left.png","vb-full-tall-team-color-right.png"],"FullWide":["vb-full-small-base.png","vb-full-small-score-mask-left.png","vb-full-small-score-mask-right.png","vb-full-small-team-mask-left.png","vb-full-small-team-mask-right.png"],"Scorebug":["vb-sb-scorebug-frames.png","vb-sb-scorebug-score-left.png","vb-sb-scorebug-score-right.png","vb-sb-scorebug-team-color-left.png","vb-sb-scorebug-team-color-right.png"],"ScorebugFull":["vb-sb-scorebug-full-arrow-left-off.png","vb-sb-scorebug-full-arrow-left-on.png","vb-sb-scorebug-full-arrow-right-off.png","vb-sb-scorebug-full-arrow-right-on.png","vb-sb-scorebug-full-color-mask-left.png","vb-sb-scorebug-full-color-mask-right.png","vb-sb-scorebug-full-frames.png","vb-sb-scorebug-full-score-mask.png","vb-sb-scorebug-full-set-overlay.png"],"ScorebugWide":["vb-scorebug-wide-set-overlay.png"],"StreamBug":["vb-stream-bug-base.png","vb-stream-bug-color-mask-left.png","vb-stream-bug-color-mask-right.png"],"_Legacy_Minimized":["vb-sb-minimized-frames.png","vb-sb-minimized-score-mask.png","vb-sb-minimized-set-1.png","vb-sb-minimized-set-2.png","vb-sb-minimized-set-3.png","vb-sb-minimized-set-4.png","vb-sb-minimized-set-5.png","vb-sb-minimized-team-color-left.png","vb-sb-minimized-team-color-right.png"],"_Legacy_Stadium":["vb-sb-stadium-frames.png","vb-sb-stadium-score-mask-left.png","vb-sb-stadium-score-mask-right.png","vb-sb-stadium-team-color-left.png","vb-sb-stadium-team-color-right.png"],"_Legacy_Standard":["vb-sb-standard-frames.png","vb-sb-standard-period-bg.png","vb-sb-standard-score-mask-left.png","vb-sb-standard-score-mask-right.png","vb-sb-standard-team-color-left.png","vb-sb-standard-team-color-right.png","volleyball_base_graphic.png"]},
    hasSubsections: true,
  },
  Wrestling: {
    rootImages: [],
    subsections: {"Condensed":["wr-condensed-advantage-marker-bottom.png","wr-condensed-advantage-marker-top.png","wr-condensed-base.png","wr-condensed-clock-stopped.png","wr-condensed-period-1-off.png","wr-condensed-period-1-on.png","wr-condensed-period-2-off.png","wr-condensed-period-2-on.png","wr-condensed-period-3-off.png","wr-condensed-period-3-on.png","wr-condensed-score-color-bottom.png","wr-condensed-score-color-top.png","wr-condensed-score-mask.png","wr-condensed-team-mask-bottom.png","wr-condensed-team-mask-top.png"],"Full":["wr-full-arrow-left.png","wr-full-arrow-right.png","wr-full-base.png","wr-full-clock-base.png","wr-full-player-score-mask-left.png","wr-full-player-score-mask-right.png","wr-full-score-color-left.png","wr-full-score-color-right.png","wr-full-team-color-left.png","wr-full-team-color-right.png","wr-full-team-score-mask-left.png","wr-full-team-score-mask-right.png"],"FullWide":["wr-full-wide-arrow-left.png","wr-full-wide-arrow-right.png","wr-full-wide-base.png","wr-full-wide-clock-base.png","wr-full-wide-clockless-base.png","wr-full-wide-score-color-left.png","wr-full-wide-score-color-right.png","wr-full-wide-score-mask-left.png","wr-full-wide-score-mask-right.png","wr-full-wide-team-mask-left.png","wr-full-wide-team-mask-right.png"],"LE":["wr-le-base.png","wr-le-score-color-left.png","wr-le-score-color-right.png","wr-le-score-mask-left.png","wr-le-score-mask-right.png","wr-le-team-color-left.png","wr-le-team-color-right.png"],"ScorebugFull":["wr-sb-scorebug-full-color-mask-left.png","wr-sb-scorebug-full-color-mask-right.png","wr-sb-scorebug-full-frames.png","wr-sb-scorebug-full-score-mask.png","wr-sb-scorebug-full-wrestler-color-left.png","wr-sb-scorebug-full-wrestler-color-right.png"],"ScorebugWide":["wr-scorebug-wide-advantage-marker-left.png","wr-scorebug-wide-advantage-marker-right.png","wr-scorebug-wide-base.png","wr-scorebug-wide-clock-stopped.png","wr-scorebug-wide-score-color-left.png","wr-scorebug-wide-score-color-right.png","wr-scorebug-wide-score-mask.png","wr-scorebug-wide-team-mask-left.png","wr-scorebug-wide-team-mask-right.png"]},
    hasSubsections: true,
  },
  break: {
    rootImages: ["16x9-cd-ind-timeout.png","16x9-cd-score-base.png","16x9-cd-time-base.png","16x9-cd-time-tab.png"],
    subsections: {},
    hasSubsections: false,
  },
  fill: {
    rootImages: ["mesh-pattern_grunge.png","mesh_pattern.png"],
    subsections: {},
    hasSubsections: false,
  },
  mocks: {
    rootImages: [],
    subsections: {"baseball":["lineup/overlay.png","lineup/realistic.png","lineup/stylized.png","sb/overlay.png","sb/realistic.png","sb/stylized.png","vb/overlay.png","vb/realistic.png","vb/stylized.png"],"basketball":["lb/overlay.png","lb/stylized.png","sb/overlay.png","sb/realistic.png","sb/stylized.png","sb+lb/overlay.png","sb+lb/realistic.png","sb+lb/stylized.png","scorebug/overlay.png","scorebug/realistic.png","scorebug/stylized.png","vb/overlay.png"],"equestrian":["player_card/overlay.png","player_card/realistic.png","player_card/stylized.png","sb/overlay.png","sb/realistic.png","sb/stylized.png"],"football":["sb/overlay.png","sb/realistic.png","sb/stylized.png","stadium/overlay.png","stadium/realistic.png","stadium/stylized.png"],"general":["countdown_indoor/overlay.png","countdown_indoor/realistic.png","countdown_indoor/stylized.png","countdown_outdoor/overlay.png","countdown_outdoor/realistic.png","countdown_outdoor/stylized.png"],"hockey":["sb/overlay.png","sb/realistic.png","sb/stylized.png","scorebug/overlay.png","scorebug/realistic.png","scorebug/stylized.png","vb/overlay.png","vb/realistic.png","vb/stylized.png"],"universal":["sb/overlay.png","sb/realistic.png","sb/stylized.png"],"volleyball":["lb/overlay.png","lb/realistic.png","lb/stylized.png","sb/overlay.png","sb/realistic.png","sb/stylized.png","sb+lb/overlay.png","sb+lb/realistic.png","sb+lb/stylized.png","scorebug/overlay.png","scorebug/realistic.png","scorebug/stylized.png","vb/overlay.png","vb/realistic.png","vb/stylized.png"],"water_polo":["sb+sc/overlay.png","sb+sc/realistic.png","sb+sc/stylized.png"],"wrestling":["sb/overlay.png","sb/realistic.png","sb/stylized.png"]},
    hasSubsections: true,
  },
  test_leaderboard: {
    rootImages: ["lb_arrow_border.png","lb_arrow_border_away.png","lb_arrow_border_home.png","lb_arrow_fill.png","lb_arrow_fill_away.png","lb_arrow_fill_home.png","lb_bb_away_highlight_border.png","lb_bb_away_slot.png","lb_bb_home_highlight_border.png","lb_bb_home_slot.png"],
    subsections: {},
    hasSubsections: false,
  },
};

// Legacy flat manifest (root images only, for backwards compatibility)
export const KNOWN_IMAGES: Record<Sport, string[]> = {
  Badminton: ["bm-sb-minimized-frames.png","bm-sb-scorebug-frames.png","bm-sb-stadium-frames.png","bm-sb-standard-frames.png"],
  Baseball: [],
  Basketball: [],
  Clock: ["base-sb-clock-stopped.png","clock-node.png"],
  Countdown: [],
  Equestrian: [],
  Football: [],
  Generic: [],
  Hockey: [],
  InfoBoard: ["16-team-bracket-base.png","4-team-bracket-base.png","8-team-bracket-base.png"],
  Lacrosse: [],
  Leaderboard: [],
  PlayerCard: ["player-card-base.png","playercard-design-concept-2.png","playercard-design-concept.png"],
  PracticeTimer: [],
  Rugby: [],
  Sequence: ["banner-mockup.png","block-mockup.png","cinema-mockup.png","double-block-mockup.png","panel-mockup.png","scorebug-framed-mockup.png","scorebug-mockup.png","sequence-scorebug-frames.png"],
  Soccer: ["large-scorebug.png"],
  Tennis: [],
  Universal: ["Full - Universal.png"],
  Volleyball: [],
  Wrestling: [],
  break: ["16x9-cd-ind-timeout.png","16x9-cd-score-base.png","16x9-cd-time-base.png","16x9-cd-time-tab.png"],
  fill: ["mesh-pattern_grunge.png","mesh_pattern.png"],
  mocks: [],
  test_leaderboard: ["lb_arrow_border.png","lb_arrow_border_away.png","lb_arrow_border_home.png","lb_arrow_fill.png","lb_arrow_fill_away.png","lb_arrow_fill_home.png","lb_bb_away_highlight_border.png","lb_bb_away_slot.png","lb_bb_home_highlight_border.png","lb_bb_home_slot.png"],
};

/**
 * Get the relative path to an image
 * @param filename - The image filename
 * @param sport - The sport category
 * @param subsection - Optional subsection within the sport
 * @returns Path like '/images/basketball/frame.png' or '/images/basketball/Full/frame.png'
 */
export function getImagePath(filename: string, sport: Sport = 'general', subsection?: string): string {
  if (subsection) {
    return `/images/${sport}/${subsection}/${filename}`;
  }
  return `/images/${sport}/${filename}`;
}

/**
 * Get all root images for a sport (always shown when sport is selected)
 */
export function getRootImages(sport: Sport): string[] {
  return SPORT_IMAGE_DATA[sport]?.rootImages || [];
}

/**
 * Get all images for a sport (legacy, returns only root images)
 */
export function getImagesForSport(sport: Sport): string[] {
  return getRootImages(sport);
}

/**
 * Get subsection names for a sport
 */
export function getSubsections(sport: Sport): string[] {
  const data = SPORT_IMAGE_DATA[sport];
  return data ? Object.keys(data.subsections) : [];
}

/**
 * Get images for a specific subsection
 */
export function getSubsectionImages(sport: Sport, subsection: string): string[] {
  return SPORT_IMAGE_DATA[sport]?.subsections[subsection] || [];
}

/**
 * Check if a sport has subsections
 */
export function hasSubsections(sport: Sport): boolean {
  return SPORT_IMAGE_DATA[sport]?.hasSubsections || false;
}

/**
 * Get all available images for a sport (root + selected subsection)
 * @param sport - The sport category
 * @param subsection - Optional subsection to include
 * @returns Combined array of root images and subsection images
 */
export function getAvailableImagesForSport(sport: Sport, subsection?: string): string[] {
  const data = SPORT_IMAGE_DATA[sport];
  if (!data) return [];

  const images = [...data.rootImages];

  if (subsection && data.subsections[subsection]) {
    images.push(...data.subsections[subsection]);
  }

  return images;
}

/**
 * Check if an image exists in a sport category
 */
export function hasImage(filename: string, sport: Sport): boolean {
  const data = SPORT_IMAGE_DATA[sport];
  if (!data) return false;

  // Check root images
  if (data.rootImages.includes(filename)) return true;

  // Check all subsections
  for (const images of Object.values(data.subsections)) {
    if (images.includes(filename)) return true;
  }

  return false;
}

/**
 * Find which sport an image belongs to
 */
export function findImageSport(filename: string): Sport | null {
  for (const sport of AVAILABLE_SPORTS) {
    if (hasImage(filename, sport)) {
      return sport;
    }
  }
  return null;
}
