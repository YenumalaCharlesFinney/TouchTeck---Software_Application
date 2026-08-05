export type ScoreboardResolution = 'auto' | '16:9' | '16:10' | '4:3' | '5:4' | '1:1' | '12:4' | '21:9' | '32:9' | 'custom';

export interface ScoreboardDisplayConfig {
  showCompetitionName: boolean;       // 1. Competition name
  showEventName: boolean;             // 2. Event name with distance
  showGender: boolean;                // 2.a Gender
  showAgeCategory: boolean;           // 2.b Age category
  showEventNumber: boolean;           // 2.c Event number
  showHeatNumber: boolean;            // 2.d Heat number
  showLaneNumber: boolean;            // 3. Lane number
  showDistrictName: boolean;          // 4. District / Club name
  showPlayerName: boolean;            // 5. Player / Swimmer name
  showPlayerPosition: boolean;        // 6. Player position (1st, 2nd, 3rd)
  showSplitTiming: boolean;           // 7. Split timing
  showRunningFinishingTime: boolean;  // 8. Running time and finishing time
  resolution?: ScoreboardResolution;  // LED Screen Aspect Ratio / Resolution
  customAspectWidth?: number;         // Custom manual width ratio (e.g. 12)
  customAspectHeight?: number;        // Custom manual height ratio (e.g. 4)
}

export const DEFAULT_SCOREBOARD_CONFIG: ScoreboardDisplayConfig = {
  showCompetitionName: true,
  showEventName: true,
  showGender: true,
  showAgeCategory: true,
  showEventNumber: true,
  showHeatNumber: true,
  showLaneNumber: true,
  showDistrictName: true,
  showPlayerName: true,
  showPlayerPosition: true,
  showSplitTiming: true,
  showRunningFinishingTime: true,
  resolution: 'auto',
  customAspectWidth: 12,
  customAspectHeight: 4
};
