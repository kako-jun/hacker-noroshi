/**
 * 共通定数
 * クライアント・サーバー両方から import 可能
 */

/** flag に必要な最小 karma（本家 HN 準拠） */
export const FLAG_KARMA_THRESHOLD = 30;

/** vouch に必要な最小 karma（本家 HN 準拠） */
export const VOUCH_KARMA_THRESHOLD = 30;

/** downvote に必要な最小 karma（本家 HN 準拠） */
export const DOWNVOTE_KARMA_THRESHOLD = 500;

/** flag 累計が **超える**と dead 化されるしきい値（5本目で dead） */
export const DEAD_FLAG_THRESHOLD = 4;

/** 編集・削除のウィンドウ（ミリ秒） */
export const EDIT_WINDOW_MS = 2 * 60 * 60 * 1000;
