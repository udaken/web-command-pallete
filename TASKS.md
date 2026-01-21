# 実装戦略計画: Browser Extension Command Palette (Vanilla ECMAScript)

## 1. ゴールの理解
**目的:** ChromeおよびFirefoxで動作するブラウザ拡張機能「Web Command Palette」を、**npmやビルドツールを使用せず、標準的なECMAScriptのみ**で開発する。
**機能要件:**
*   **SITEINFOの利用:** サイトごとの定義ファイル（SITEINFO）を外部URLまたはオプション画面から読み込む。
*   **コマンド抽出:** SITEINFO内のXPath式に基づいて、現在閲覧中のページから操作可能なコマンドを抽出する。
*   **UI:** ページ上で `Ctrl+Shift+P` を押下するとコマンドパレット（モーダル）が表示される。
*   **実行:** パレットからコマンドを選択し、定義されたアクションを実行する。

**制約事項:**
*   **No NPM / No Build:** `npm install` やバンドラー（Vite/Webpack）は使用しない。
*   **Native Web APIs:** Web Components (Custom Elements, Shadow DOM), ES Modules, CSS Variables を活用する。

## 2. アーキテクチャ設計 (Vanilla ES)
ビルドステップがないため、ブラウザが直接解釈できるファイル構成にする。

*   **ディレクトリ構成:**
    ```
    /
    ├── manifest.json      # Manifest V3
    ├── icons/             # アイコン画像
    ├── background/
    │   └── service_worker.js
    ├── content/
    │   ├── main.js        # エントリーポイント
    │   ├── ui.js          # Web Component (Shadow DOM)
    │   └── engine.js      # コマンド抽出ロジック
    ├── options/
    │   ├── index.html
    │   ├── style.css
    │   └── main.js
    └── lib/               # 外部ライブラリが必要な場合はここに配置 (今回は自作推奨)
    ```

*   **技術選定:**
    *   **UI:** `HTMLElement` を継承した Custom Elements (`<command-palette>`)。
    *   **Style:** Shadow DOM内の `<style>` タグ + CSS Variables。
    *   **Templating:** JavaScript Template Literals (`` `...` ``) または `<template>` タグ。
    *   **Data:** `fetch` API, `chrome.storage`.

## 3. 実装フェーズ

### Phase 1: プロジェクト基盤の構築
*   `manifest.json` の作成 (Manifest V3, ES Module support)。
*   Hello World レベルの Background / Content Script の配置。
*   拡張機能の読み込みテスト。

### Phase 2: データ管理 (Options Page)
*   **Options UI:** 標準的なHTML/CSSで設定画面を作成。
*   **Storage:** `chrome.storage.local` をラッパーなしで利用し、SITEINFO (JSON) を保存・取得する処理を実装。
*   **Data Validation:** 入力されたJSONの簡易バリデーション。

### Phase 3: コマンド抽出エンジン
*   `document.evaluate` を使用したXPath評価関数の実装。
*   URLパターンマッチングの実装（Regex）。
*   現在ページとSITEINFOを照合し、コマンドリストを生成するモジュール。

### Phase 4: コマンドパレットUI (Web Component)
*   **Custom Element:** `class CommandPalette extends HTMLElement` の定義。
*   **Shadow DOM:** ページスタイルからの隔離。
*   **Internal Logic:**
    *   `<input>` の入力イベントハンドリング。
    *   Fuzzy Search (単純な文字列部分一致から開始、必要ならJSのみで実装)。
    *   キーボードナビゲーション (ArrowUp, ArrowDown, Enter)。

### Phase 5: 統合とアクション
*   **Interaction:** Content Script から Custom Element をページに注入 (`document.body.appendChild`).
*   **Execution:** 選択されたコマンドのアクション（`click()`, `focus()`, etc.）を実行。
*   **Shortcut:** `Ctrl+Shift+P` イベントの監視。

## 4. 検証
*   Chrome/Firefox の「パッケージ化されていない拡張機能を読み込む」機能で直接ディレクトリを指定して動作確認。
*   コンソールエラー（CSP違反など）の確認。