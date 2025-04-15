
---

# Google AI Studio Gemini Key 脚本合集 🚀

**English Version:** [README.en.md](README.en.md)

**默认语言：中文**  

本仓库包含了 **3 个核心脚本**，帮助你**批量创建 Google Cloud 项目**并**获取 Google AI Studio（Gemini）API Key**。即便你不熟悉编程，也可按下述步骤轻松上手。  
适用于需要大规模管理 Key 或频繁创建新项目的场景。

> ⚠️ **重要提示 / 免责声明**  
> - **本项目仅供学习和参考使用，任何由此脚本引发的风险由使用者自行承担。**  
> - **由于 Google 限制原因，每个项目的 API Key 共享同一资源，默认每个项目只创建 1 个 Key，且建议单账号不超过 5 个项目。**  
> - 代码可直接复制粘贴执行（脚本内注释已说明可调整参数），若需修改，可根据注释进行微调。  
> - Google 可能随时更新界面或接口，如脚本失效，请自行调试或提交 Issue。  
> - **请遵守 Google Cloud 与 Google AI Studio 的服务条款，避免恶意或高频操作导致账号受限。**  
> - **如果你觉得本项目有帮助，欢迎点个 Star ⭐️ 支持！**

---

## 目录
1. [功能概览](#功能概览)  
2. [环境准备](#环境准备)  
3. [流程总览](#流程总览)  
4. [用户自定义配置](#用户自定义配置)  
5. [油猴脚本与控制台脚本使用方式](#油猴脚本与控制台脚本使用方式)  
   - [方式一：油猴脚本 —— Google AI Studio Gemini Automation Suite](#方式一油猴脚本--google-ai-studio-gemini-automation-suite)  
   - [方式二：控制台脚本](#方式二控制台脚本)  
6. [仓库结构](#仓库结构)  
7. [常见问题 (FAQ)](#常见问题-faq)  
8. [可选操作：申请更多项目配额](#可选操作申请更多项目配额)  
9. [贡献与反馈](#贡献与反馈)  

---

## 功能概览

本仓库的脚本可为你提供以下便利：  

- **自动化项目创建**  
  无需手动点击多次，即可在 Google Cloud Console 中批量创建若干项目。  

- **自动化 API Key 生成**  
  在 Google AI Studio 中为每个新项目自动生成 Gemini API Key，并将结果在浏览器控制台输出，方便统一管理与复制。  

- **自动提取已有 API Key**  
  扫描当前账号下已有的 API Key 并列表输出，让你不会遗失已有的 Key。  

---

## 环境准备

1. **Google 账号**  
   - 需登录 [Google Cloud Console](https://console.cloud.google.com/) 与 [Google AI Studio](https://aistudio.google.com/)。  
   - 若设置了双因素认证（2FA）或使用企业/学校账号，请先完成解锁。  

2. **浏览器和网络**  
   - 建议使用最新版 Chrome、Edge 或 Firefox。  
   - 确保网络畅通且可访问 Google 服务，否则脚本可能报错或卡住。  

3. **项目配额**  
   - 免费账号默认可创建 **12 个项目**。若不够，可参考下文[可选操作：申请更多项目配额](#可选操作申请更多项目配额)。  

---

## 流程总览

下图简要说明了从登录到创建项目、生成 Key 的完整操作顺序：

```
 ┌────────────────────────────┐
 │ 1. 登录 Google Cloud     │
 │    (若需 2FA 先解锁)       │
 └──────────────┬─────────────┘
                │
                ▼
 ┌────────────────────────────┐
 │ 2. (可选) 申请更多配额     │
 └──────────────┬─────────────┘
                │
                ▼
 ┌────────────────────────────┐
 │ 3. 运行创建项目脚本        │
 │    (批量创建新项目)        │
 └──────────────┬─────────────┘
                │
                ▼
 ┌────────────────────────────┐
 │ 4. 登录 AI Studio          │
 │    打开 /apikey 页面       │
 └──────────────┬─────────────┘
                │
                ▼
 ┌────────────────────────────┐
 │ 5. 运行生成 Key 脚本       │
 │    (批量生成 API Key)      │
 └──────────────┬─────────────┘
                │
                ▼
  (可选) 如果已有 Key
 ┌────────────────────────────┐
 │ 6. 运行提取 Key 脚本       │
 │   (扫描已存在的所有Key)    │
 └────────────────────────────┘
```  

---

## 用户自定义配置

如果你使用 **油猴脚本**，在脚本开头会有一个名为 `CONFIG` 的对象，你可在其中修改以下参数：  
- **PROJECT_CREATION_COUNT**：默认创建项目数（如 5）。  
- **API_KEYS_PER_PROJECT**：每个项目要创建的 Key 数量（如 1）。  
- **PROJECT_CREATION_DELAY**：两次创建项目之间的间隔时间（毫秒）。  
- **API_KEY_CREATION_DELAY**：两次生成 Key 之间的间隔时间（毫秒）。  
- **SELECT_CHANGE_DELAY**：下拉框选项点击后，额外等待时间（毫秒）以确保操作生效。

如果你对脚本略懂修改，可以根据自己网络速度和需求微调这些值以减少错误。

---

## 油猴脚本与控制台脚本使用方式

### 方式一油猴脚本--google-ai-studio-gemini-automation-suite

此油猴脚本将项目创建、API Key 生成与 Key 提取三大功能集成在一起，并在页面中插入浮动按钮，让操作更直观。  

#### 使用步骤

1. **安装 Tampermonkey**  
   - 在浏览器插件商店搜索并安装 “Tampermonkey”（或其他用户脚本管理器）。
   - 懒得搜索，也可以点[这里](https://www.tampermonkey.net/)直达 

2. **导入油猴脚本**  
   - 将本仓库中的 `Google_AI_Studio_Gemini_Automation_Suite.user.js` 文件保存后，添加到 Tampermonkey。  
   - 若需自定义项目数、等待时间等配置，可在脚本开头的 `CONFIG` 对象中进行修改。  

3. **操作说明**  
   - **在 Google Cloud Console**：  
     进入 [Google Cloud Console](https://console.cloud.google.com/)，页面右上角出现名为 “创建项目并获取APIKEY” 的按钮：  
     1. 若当前页面不在 `console.cloud.google.com` 域下，脚本会自动跳转到此域。  
     2. 点击按钮后，脚本会按照配置批量创建项目，完成后自动记录标记并跳转到 [Google AI Studio /apikey](https://aistudio.google.com/apikey) 页面。  
   - **在 Google AI Studio**：  
     进入 `/apikey` 页面后，脚本检测到标记并开始批量创建 API Key。  
     - 对于首次下拉框点击，脚本会派发 `change` 事件并等待一小段时间（默认 1000 毫秒）以确保操作生效。  
   - **提取已有 Key**：  
     点击浮动按钮 “提取APIKEY” 即可扫描并输出所有已存在的 Key 到浏览器控制台。  

---

### 方式二控制台脚本

如果你更喜欢在 Console（浏览器开发者工具）中手动执行脚本，或只想执行部分功能，则可使用控制台脚本。

#### 使用步骤

1. **项目创建**：  
   - 登录 [Google Cloud Console](https://console.cloud.google.com/)  
   - 按 `F12` 打开开发者工具 → Console，将 [`CreateProjects.js`](./CreateProjects.js) 文件中全部代码复制并粘贴，按 Enter 执行。  

2. **API Key 自动生成**：  
   - 登录 [Google AI Studio /apikey](https://aistudio.google.com/apikey)。  
   - 在 Console 中复制 [`FetchApiKeys.js`](./FetchApiKeys.js) 文件的全部代码并执行。  

3. **提取已有 Key（可选）**：  
   - 同样在 [Google AI Studio /apikey](https://aistudio.google.com/apikey) 页面，Console 中复制 [`FetchAllExistingKeys.js`](./FetchAllExistingKeys.js) 代码并执行，脚本会扫描并输出当前账号已有的所有 Key。  

---

## 仓库结构

```bash
google-ai-gemini-key-scripts/
├─ CreateProjects.js           # (Step 1) 控制台脚本版：自动创建项目脚本
├─ FetchApiKeys.js             # (Step 2) 控制台脚本版：自动为项目创建并获取 API Key
├─ FetchAllExistingKeys.js     # (Step 3, 可选) 控制台脚本版：提取所有已有的 API Key
├─ Google_AI_Studio_Gemini_Automation_Suite.user.js  # 油猴脚本版（整合全部功能）
├─ README.md                   # 本文档（中文版）
```

---

## 常见问题-faq

1. **脚本无反应或报错？**  
   - 请确认已登录到正确的页面（Google Cloud Console / AI Studio），检查控制台报错信息。  
   - 若出现选择器失效，可能是 Google 界面改版导致，需要更新脚本。  
   - 网络不稳定也会导致脚本卡住或超时。  

2. **Key 没有生成或只生成部分？**  
   - 可能是配额耗尽、网络波动或等待时间不足造成。  
   - 尝试降低一次性创建数量或增加等待延时（如 `SELECT_CHANGE_DELAY`）。  

3. **会不会被 Google 封号？**  
   - 脚本涉及自动批量操作，存在一定风险。请合理使用，避免短时间内频繁创建或删除项目与 Key。  

4. **如何申请更多项目配额？**  
   - 请参见下方【可选操作：申请更多项目配额】或查看 Google 官方文档。  

5. **生成的 Key 如何使用？**  
   - 一般在请求头中使用 `Authorization: Bearer YOUR_KEY`。  
   - 具体请参考 Google AI Studio 官方文档。  

6. **首次生成 API Key 失败怎么办？**  
   - 脚本点击下拉框后会触发 `change` 事件并等待默认 1000 毫秒，如仍失败，请适度调整该值或多尝试几次。  

7. **油猴脚本还是控制台脚本？**  
   - **油猴脚本** 一键式全自动，适合追求省事；  
   - **控制台脚本** 手动复制粘贴，适合部分功能或调试。  

---

## 可选操作申请更多项目配额

若默认的 12 个项目额度不足，你可以在**创建项目之前**前往 [配额申请页面](https://support.google.com/code/contact/project_quota_increase) 申请更多项目配额。具体步骤可参考本仓库或 Google 官方文档，一般需要填写合理的申请理由并等待审核。

---

## 贡献与反馈

- 如在使用过程中遇到问题或有改进建议，欢迎在 GitHub 提交 Issue 或 Pull Request。  
- 希望本项目能帮你批量创建项目与管理 API Key，节省宝贵时间。  
- 感谢你的关注，也祝开发顺利！🚀


---

