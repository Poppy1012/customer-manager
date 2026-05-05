# 客戶管理網站

這是一個純前端客戶管理工具，可直接用瀏覽器開啟 `index.html` 使用。訪客模式會把資料存到目前瀏覽器的 `localStorage`。

## 功能

- 客戶欄位：姓名、電話、本次商品細項、本次收款、欠款金額、地址、預計下次送貨時間、備註
- 地址可開啟 Google Maps
- 下次送貨時間可加入 Google 行事曆
- 新增、編輯、刪除、搜尋
- Excel `.xlsx` 完整匯出與匯入
- 深色模式預設開啟，可切換亮色
- Google 登入 UI：登入後顯示頭像、名字與登出按鈕
- 登入後資料會依 Google 帳號 ID 分開存放在 `localStorage`

## Google 登入設定

到 Google Cloud Console 建立 OAuth 2.0 Client ID，類型選「網頁應用程式」，把你的本機或正式網址加入 Authorized JavaScript origins。

目前已套用你的 Google Client ID：

```js
const CLIENT_ID = "95788600787-f8uq7eg5rs5vb7i9r1i7m88npkdb0upd.apps.googleusercontent.com";
```

沒有設定 Client ID 時，網站仍可用訪客模式管理資料。

Google 登入需要在 `http://localhost` 或正式 `https://` 網址執行；直接用 `file://` 開啟時，訪客模式可用，但 Google 登入通常不會啟用。
