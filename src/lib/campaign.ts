// ============================================================
// 七五三 9時枠キャンペーン
// ------------------------------------------------------------
// MVP: 設定はコード固定（定数）。将来 campaigns テーブルへ差し替える際は
// getActiveCampaign() の中身だけDB読み込みに置き換えればよい（呼び出し側は不変）。
// ============================================================

// 予約シーン名（SHOOTING_SCENES / SCENE_PLAN_MAP にも追加済み）
export const CAMPAIGN_SCENE = 'キャンペーン';

// キャンペーンで表示するオプションの external_code（被布/羽織袴/作り帯の着付け3種）
export const CAMPAIGN_OPTION_CODES = ['OP001', 'OP002', 'OP003'] as const;

export interface Campaign {
  name: string;
  targetScene: string;          // 例 'キャンペーン'
  isActive: boolean;
  startDate: string;            // 'YYYY-MM-DD'（撮影日がこの範囲内なら対象）
  endDate: string;              // 'YYYY-MM-DD'
  allowedTimeSlots: string[];   // 予約可能な時間枠（例 ['9:00']）
  arrivalTime: string;          // ご来店時間（例 '8時45分'）
  /** 日時選択時に赤字で表示する注記 */
  redNotes: string[];
  /** 日時選択後に表示する【キャンペーン内容】 */
  contentLines: string[];
  /** 日時選択後に表示する【注意事項】（同意必須・フォーム表示用） */
  formNoticeLines: string[];
  /** LINE（仮予約・予約確定）の「⚠️撮影に関する注意事項」に追加する項目 */
  lineNoticeLines: string[];
}

// MVP固定のキャンペーン定義（原文ママ）
const MVP_CAMPAIGN: Campaign = {
  name: '【9時枠限定】アルバムプレゼントキャンペーン',
  targetScene: CAMPAIGN_SCENE,
  isActive: true,
  startDate: '2026-07-01',
  endDate: '2026-08-31',
  allowedTimeSlots: ['9:00'],
  arrivalTime: '8時45分',
  redNotes: [
    '※ ご来店時間は8時45分でございます。',
    '※ 所要時間は約1時間～1時間半です。',
    '※ お着物1着のみでのご撮影となります。ヘアチェンジはございません。',
  ],
  contentLines: [
    '〈【9時枠限定】アルバムプレゼントキャンペーン📚〉',
    '〇料金　平日：49,500円／休日：55,000円',
    '〇内容',
    '撮影時間：約30分',
    'お渡しデータ：40カット（カメラマンセレクト）',
    '対象撮影：七五三撮影',
    '撮影パターン：家族集合写真（1背景のみ）・ご主役様ソロカット',
    'ご来店時間：8時45分（お仕度が終了次第、ご撮影開始）',
    '〇特典　A5アルバム1冊（24P）プレゼント（16,500円相当）📚',
    '※アルバムの表紙や中面のお写真はすべておまかせ',
    '〇キャンペーン期間　2026年7月1日(水)〜2026年8月31日(月)',
  ],
  formNoticeLines: [
    'お着物1着のみでのご撮影となります。ヘアチェンジはございません。',
    'お着付け料金は別途頂戴いたします。',
    '👘3歳（被布）：4,400円／👘5歳（羽織袴）：5,500円／👘7歳（作り帯）：6,600円',
    'お持ち込み着物でのお着付けはお受けできかねます。',
    '撮影後のスライドショーの上映はございません。',
    'ご撮影パターンは家族集合写真（1シーンのみ）・ご主役様ソロカットです。',
    'ごきょうだい様への衣装のお貸出しやヘアメイクはございません。',
    'ごきょうだい様も一緒にご来店の場合、家族集合写真にのみご参加いただけます。',
    'お子様のお着付け以外のオプション（ご両親様のヘアメイクやお着付け等）はお受けできかねます。',
  ],
  lineNoticeLines: [
    'お着物1着のみでのご撮影となります。ヘアチェンジはございません。',
    'お持ち込み着物でのお着付けはお受けできかねます。',
    '撮影後のスライドショーの上映はございません。',
    'ご撮影パターンは家族集合写真（1シーンのみ）・ご主役様ソロカットです。',
    'ごきょうだい様への衣装のお貸出しやヘアメイクはございません。',
    'ごきょうだい様も一緒にご来店の場合、家族集合写真にのみご参加いただけます。',
    'お子様のお着付け以外のオプション（ご両親様のヘアメイクやお着付け等）はお受けできかねます。',
  ],
};

/**
 * 有効なキャンペーンを返す。dateStr（撮影日）を渡した場合は、その日が期間内のときのみ返す。
 * is_active=false または期間外なら null。
 * MVPは定数を返すだけ。将来はここをDB（campaignsテーブル）読み込みに差し替える。
 */
export function getActiveCampaign(dateStr?: string): Campaign | null {
  const c = MVP_CAMPAIGN;
  if (!c.isActive) return null;
  if (dateStr && (dateStr < c.startDate || dateStr > c.endDate)) return null;
  return c;
}

/** シーンがキャンペーンかどうか */
export function isCampaignScene(scene?: string | null): boolean {
  return scene === CAMPAIGN_SCENE;
}

/** キャンペーンが現在（期間に関係なく）有効か。シーンボタンの表示可否に使用。 */
export function isCampaignEnabled(): boolean {
  return getActiveCampaign() !== null;
}
