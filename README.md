# 線上錯題本 (Online Mistake Notebook) - 本地測試與部署指南

這是一個基於 **React + Vite + TypeScript** 前端，與 **Cloudflare Pages Functions** 後端建置的「線上錯題本」網站。它完全使用 Cloudflare 的免費服務（Pages、D1 SQL 資料庫、R2 物件儲存）運行，並支援客戶端圖片自動壓縮與雙模式 PDF 錯題卷匯出。

---

## 🚀 本地測試步驟 (Localhost Testing)

請依照以下三個步驟，在本地端以 `localhost` 啟動並測試完整功能：

### 步驟 1：初始化本地 D1 資料庫
在專案根目錄下開啟 PowerShell 或終端機，執行以下指令將 SQL 結構表寫入本地 D1 模擬器：
```bash
npx wrangler d1 execute mistake-notebook-db --local --file=./db/schema.sql
```
> 執行此步驟後，Wrangler 會在本地建立 `.wrangler/state/v3/d1` 目錄來儲存資料庫檔案。

### 步驟 2：啟動前端 Vite 開發伺服器
在第一個終端機視窗中，啟動 Vite 前端伺服器（預設運行在 `http://localhost:5173`）：
```bash
npm run dev
```

### 步驟 3：啟動 Wrangler Pages 後端模擬與代理
在第二個終端機視窗中，啟動 Cloudflare Pages 後端 Functions 模擬器，並將前端請求代理至 Vite：
```bash
npx wrangler pages dev --port=8788 --proxy=http://localhost:5173
```
> 此時，Wrangler 會在 `http://localhost:8788` 啟動整合後的伺服器。
> **請在瀏覽器中直接開啟 `http://localhost:8788` 來進行測試！**

---

## 🎨 功能亮點與架構

1. **使用者註冊與登入**：採用 Web Crypto API (PBKDF2/SHA-256) 進行密碼雜湊，搭配 JWT Cookie 進行身分驗證，無須任何第三方 NPM 密碼庫。
2. **動態模板編輯器**：支援分別為「題目區」與「答案解析區」獨立設計欄位（文字、多行、選項、圖片），以 JSON 格式儲存在 D1 中。
3. **客戶端圖片壓縮**：上傳圖片時會自動透過 Canvas 等比例壓縮（寬度上限 1200px、品質 0.8），節省上傳時間並減少 R2 空間佔用。
4. **雙模式 PDF 匯出**：
   - **練習卷模式**：隱藏答案與解析，僅生成題目及作答區，方便重新練習。
   - **解析卷模式**：顯示所有欄位與詳細圖文解析，供複習對答案。
   - 利用瀏覽器原生列印 (`window.print()`) 將網頁渲染為精美的 A4 頁面，不佔用任何 Worker CPU 額度。

---

## ☁️ 部署到 Cloudflare (Cloudflare Production Deployment)

當您在本地測試滿意後，可以透過以下步驟免費部署至雲端：

### 1. 建立雲端 D1 資料庫與 R2 儲存桶
登入您的 Cloudflare 控制台，前往以下頁面建立資源：
- **D1 資料庫**：建立一個名為 `mistake-notebook-db` 的資料庫，並複製其 `database_id`。
- **R2 儲存桶**：建立一個名為 `mistake-notebook-bucket` 的儲存桶。

### 2. 更新資料庫 id
將 `wrangler.json` 中的 `database_id` 替換成您剛剛建立的雲端 D1 資料庫 ID：
```json
{
  "database_id": "您雲端的-D1-database-id"
}
```

### 3. 在 Cloudflare 執行雲端資料庫初始化
執行以下指令將結構表建立在雲端的 D1 資料庫中：
```bash
npx wrangler d1 execute mistake-notebook-db --remote --file=./db/schema.sql
```

### 4. 部署專案至 Cloudflare Pages
在 Cloudflare 控制台 -> **Workers & Pages** -> **Create an application** -> **Pages** 中，連結您的 GitHub 專案：
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **環境變數 (Environment Variables)**：在 Pages 設定中，新增變數 `JWT_SECRET`，填入您自訂的隨機安全金鑰字串。
- **綁定設定 (Bindings)**：在 Pages 的 **Settings -> Functions** 中，新增以下兩個 Bindings：
  1. **D1 database binding**: 綁定名稱為 `DB`，選擇您的 `mistake-notebook-db`。
  2. **R2 bucket binding**: 綁定名稱為 `BUCKET`，選擇您的 `mistake-notebook-bucket`。

重新觸發部署後，您的線上錯題本網站便已成功上線！
