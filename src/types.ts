export type EventType = 'singles' | 'doubles' | 'team';
export type EventFormat = 'tournament' | 'league' | 'league-tournament';
export type MatchStatus = 'waiting' | 'called' | 'playing' | 'done' | 'bye';
export type Side = 'a' | 'b';
export type FinishType = 'normal' | 'retired' | 'walkover';

export interface ScoreRules {
  /** 1ゲームの点数（21, 15, 11 など） */
  points: number;
  /** 上限点（30 など。デュースなしの場合は points と同じ） */
  cap: number;
  /** 勝利に必要なゲーム数（3ゲームマッチなら2） */
  gamesToWin: number;
}

export interface Player {
  id: string;
  name: string;
  kana: string;
  affiliation: string;
  gender: '' | 'M' | 'F';
  category: string;
  note: string;
}

/** 団体戦の各試合（例：第1ダブルス） */
export interface RubberDef {
  label: string;
  type: 'singles' | 'doubles';
}

export interface TEvent {
  id: string;
  name: string;
  type: EventType;
  format: EventFormat;
  rules: ScoreRules;
  /** 3位決定戦を行う */
  thirdPlace: boolean;
  /** リーグのグループ数 */
  groupCount: number;
  /** 各グループから決勝トーナメントに進む数 */
  advancePerGroup: number;
  /** 参加費（1エントリーあたり） */
  fee: number;
  /** 団体戦のオーダー */
  rubbers: RubberDef[];
  /** 団体戦で勝敗が決まったら残りの試合を打ち切る */
  stopWhenDecided: boolean;
  /** 1試合の見込み時間（分）*/
  estMinutes: number;
}

export interface Entry {
  id: string;
  eventId: string;
  /** 個人戦：選手（ダブルスは2名）、団体戦：メンバー */
  playerIds: string[];
  /** 団体戦のチーム名 */
  teamName: string;
  /** シード順位（0=なし） */
  seed: number;
  /** リーグのグループ番号（0始まり、未割当は -1） */
  group: number;
}

export interface Rubber {
  label: string;
  type: 'singles' | 'doubles';
  a: string[];
  b: string[];
  games: [number, number][];
  winner?: Side;
  finish: FinishType;
}

export interface Match {
  id: string;
  eventId: string;
  stage: 'main' | 'league' | 'third';
  /** トーナメント：1=1回戦。リーグ：対戦順の回 */
  round: number;
  /** 同じ回戦の中での位置（0始まり） */
  slot: number;
  group: number;
  /** 試合番号（BYEは0） */
  number: number;
  a: string | null;
  b: string | null;
  nextMatchId: string | null;
  nextSide: Side | null;
  loserNextMatchId: string | null;
  loserNextSide: Side | null;
  status: MatchStatus;
  court: number | null;
  games: [number, number][];
  winner?: Side;
  finish: FinishType;
  rubbers: Rubber[];
  calledAt?: number;
  startedAt?: number;
  endedAt?: number;
}

export interface CertificateSettings {
  orientation: 'vertical' | 'horizontal';
  title: string;
  body: string;
  organizer: string;
  dateText: string;
  showAffiliation: boolean;
}

export interface Tournament {
  name: string;
  date: string;
  venue: string;
  organizer: string;
  courts: number;
  /** 試合間の最低休憩時間（分） */
  restMinutes: number;
  startTime: string;
  /** 1人が出場できる種目数の上限（0=無制限） */
  maxEventsPerPlayer: number;
  callTemplate: string;
  speechRate: number;
  voiceName: string;
  certificate: CertificateSettings;
  paidAffiliations: string[];
}

export interface AppState {
  version: 1;
  tournament: Tournament;
  players: Player[];
  events: TEvent[];
  entries: Entry[];
  matches: Match[];
}
