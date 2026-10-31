import type { AppState } from '../types';
import { defaultState, newEvent } from './defaults';
import { uid } from './util';

const SEI = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '清水', '山崎'];
const SEI_K = ['さとう', 'すずき', 'たかはし', 'たなか', 'いとう', 'わたなべ', 'やまもと', 'なかむら', 'こばやし', 'かとう', 'よしだ', 'やまだ', 'ささき', 'やまぐち', 'まつもと', 'いのうえ', 'きむら', 'はやし', 'しみず', 'やまざき'];
const MEI = ['翔太', '大輝', '健太', '拓海', '蓮', '陽菜', '結衣', '美咲', '葵', '花子'];
const MEI_K = ['しょうた', 'だいき', 'けんた', 'たくみ', 'れん', 'ひな', 'ゆい', 'みさき', 'あおい', 'はなこ'];
const CLUBS = ['横浜クラブ', '川崎BC', '湘南RC', '鎌倉ジュニア', '相模原SC', '藤沢クラブ'];

export function sampleState(): AppState {
  const s = defaultState();
  s.tournament.name = '第1回 サンプル市民バドミントン大会';
  s.tournament.venue = '市民体育館';
  s.tournament.organizer = 'サンプル市バドミントン協会';
  s.tournament.certificate.organizer = 'サンプル市バドミントン協会 会長 山田太郎';
  let k = 0;
  const person = (club: string) => {
    const i = k++;
    const p = { id: uid('p'), name: `${SEI[i % 20]} ${MEI[Math.floor(i / 20) % 10]}`, kana: `${SEI_K[i % 20]} ${MEI_K[Math.floor(i / 20) % 10]}`, affiliation: club, gender: '' as const, category: '一般', note: '' };
    s.players.push(p);
    return p.id;
  };
  const sg = newEvent('singles', '一般男子シングルス');
  sg.fee = 1500;
  const db = newEvent('doubles', '一般男子ダブルス');
  db.fee = 3000;
  const tm = newEvent('team', '団体戦');
  tm.format = 'league';
  tm.groupCount = 1;
  tm.fee = 8000;
  s.events.push(sg, db, tm);
  for (let i = 0; i < 28; i++)
    s.entries.push({ id: uid('n'), eventId: sg.id, playerIds: [person(CLUBS[i % CLUBS.length])], teamName: '', seed: i < 4 ? i + 1 : 0, group: -1 });
  for (let i = 0; i < 12; i++) {
    const c = CLUBS[(i * 5) % CLUBS.length];
    s.entries.push({ id: uid('n'), eventId: db.id, playerIds: [person(c), person(c)], teamName: '', seed: i < 2 ? i + 1 : 0, group: -1 });
  }
  for (let i = 0; i < 4; i++) {
    const c = CLUBS[i];
    s.entries.push({ id: uid('n'), eventId: tm.id, playerIds: [person(c), person(c), person(c), person(c), person(c)], teamName: `${c}A`, seed: 0, group: -1 });
  }
  return s;
}
