# SwipePlanner (GitHub Pages 一键部署版本)

这是一个可以左右“刷”项目的个人时间管理网页（像 dating app 的交互），每个项目内有 Today / Backlog / Done 三栏任务，支持拖拽、编辑、删除，并自动保存到浏览器本地。

## 本地运行
```bash
npm i
npm run dev
```

## 部署到 GitHub Pages
1. 在 GitHub 新建一个仓库（例如 `swipe-planner`），把本项目推上去：
   ```bash
   git init
   git add .
   git commit -m "init: SwipePlanner"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/swipe-planner.git
   git push -u origin main
   ```
2. 运行：
   ```bash
   npm run deploy
   ```
   这会把 `dist` 发布到 `gh-pages` 分支。

3. 打开仓库 Settings → Pages，确认 Source 选择 `gh-pages` 分支。几分钟后即可访问：  
   `https://<你的用户名>.github.io/swipe-planner/`

> 如果你的仓库名不是 `swipe-planner`，请修改 `vite.config.js` 里的 `base` 为 `/<你的仓库名>/`。

## 技术栈
- Vite + React
- TailwindCSS
- framer-motion（滑动/拖拽）
- lucide-react（图标）
