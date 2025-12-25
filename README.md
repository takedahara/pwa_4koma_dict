4コマIT用語辞書 PWA｜開発メモ
1. このアプリは何か（目的）

IT用語を 4コマ画像で直感的に理解する辞書

完全オフライン対応

iPhone / Mac のホーム画面から アプリのように起動

将来：語彙数1000語以上、将来的な収益化も視野

2. 現在できていること（2025-XX-XX 時点）

GitHub Pages 上で公開済み
https://takedahara.github.io/pwa_4koma_dict/

PWAとして：

ホーム画面に追加可能

初回に全画像キャッシュ

機内モードでも表示可能

terms.json から用語を読み込み

画像（webp）を表示

Service Worker が正常に動作

3. ディレクトリ構成（重要）
pwa_4koma_dict/
├ index.html            # 画面
├ app.js                # 表示ロジック
├ sw.js                 # Service Worker（オフライン対応）
├ terms.json             # 用語データ
├ manifest.webmanifest   # PWA設定
├ icons/
│  ├ icon-192.png
│  └ icon-512.png
└ images/
   ├ binary_search.webp
   ├ two_phase_commit.webp
   └ three_layer.webp

4. アプリの基本的な使い方（ユーザー視点）

SafariでURLを開く

初回は「オフライン準備中」が出る

キャッシュ完了後、通常表示

ホーム画面に追加するとアプリとして起動

オフラインでも4コマ閲覧可能

5. 技術的な仕組み（超重要）
PWAの構成

GitHub Pages（HTTPS）

manifest.webmanifest

start_url と scope は
/pwa_4koma_dict/ に固定（iOS対策）

Service Worker

APP_SHELL を初回で全キャッシュ

完全オフライン動作

キャッシュの考え方

CACHE_VERSION を使って世代管理

APP_SHELL を変更したら必ず v を上げる

例：v1 → v2

vを上げないと「古い世界」が残り、不具合が出る

6. これまでにハマったポイント（再発防止）
① ドメイン直下 vs プロジェクト直下

❌ /sw.js や /icons/...

✅ sw.js, icons/icon-512.png

GitHub Pages（プロジェクトPages）は 相対パス基本

② 日本語ファイル名の罠

「サーバ」と「サーバ（結合文字）」は別物

画像ファイル名は英数字ID推奨

③ iOSのPWAキャッシュが強すぎる

変更が反映されない時は：

CACHE_VERSION を上げる

PWAを一度削除して再追加

7. 今後修正・改善していくべきポイント
優先度：高

 画像ファイル名を すべて英数字IDに統一

 terms.json を id基準設計にする

 用語数が増えても壊れない確認（10語→50語）

優先度：中

 検索機能（前方一致だけでOK）

 カテゴリ切り替え

 表示順の安定化

優先度：低（将来）

 学習履歴（localStorage）

 お気に入り

 有料化の導線設計（後回しでOK）

8. 再開するときのチェックリスト

再開時はこの順で見る：

manifest.webmanifest

start_url / scope が /pwa_4koma_dict/ か

sw.js

CACHE_VERSION は最新か

GitHub Pages のURLで直接表示できるか

オフラインで表示できるか

画像404が出ていないか（Network）

9. このアプリの位置づけ（忘れないために）

❌ 問題演習アプリではない

❌ 時間切り売りではない

✅ 資産型（増やすほど価値が上がる）

✅ 自分の勉強 × 将来の副業につながる

10. 次にやるならおすすめ

まず 10〜20語に増やす

表示が破綻しないことを確認

その後に検索 or UI改善
