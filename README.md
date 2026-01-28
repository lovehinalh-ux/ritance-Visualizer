# Inheritance Visualizer 🏛️

一個簡單易用的遺產分配模擬器，幫助使用者理解台灣繼承法的應繼分與特留分規劃。

## 功能特點

- **家庭關係建立**：直觀設定被繼承人、配偶、子女及父母狀態。
- **資產管理**：支援現金、股票、不動產及保險等多種資產類型。
- **拖拉分配**：透過拖拉操作將資產分配給繼承人。
- **遺產稅估算**：自動計算 2024 年台灣遺產稅（免稅額與扣除額）。
- **特留分警示**：即時偵測分配是否低於法律規定的特留分。

## 開發指令

1. **安裝依賴**：
   ```bash
   npm install
   ```

2. **開發環境啟動**：
   ```bash
   npm run dev
   ```

3. **專案打包**：
   ```bash
   npm run build
   ```

4. **代碼檢查**：
   ```bash
   npm run lint
   ```

## 部署與安全

- **自動化部署**：推送至 `main` 分支時會自動透過 GitHub Actions 部署至 GitHub Pages。
- **資安防護**：整合 `eslint-plugin-security` 規則，確保代碼安全性。
- **秘密防護**：請勿上傳 `.env` 檔案，請參考 `.env.example` 進行配置。

## 技術棧

- React 19
- Vite 7
- TypeScript
- Tailwind CSS v4
- ESLint (with Security Plugin)

---
💡 本工具僅供參考，實際遺產規劃請諮詢專業法律或財務顧問。
