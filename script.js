// 抓取设置弹窗里的元素
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const savePromptBtn = document.getElementById("savePromptBtn");
const promptInput = document.getElementById("promptInput");

// 1. 填入你的 DeepSeek API Key
const API_KEY = "sk-f813321968064beda98a4186cef6e175";

// 2. 获取网页上的元素
const chatMessages = document.getElementById("chatMessages");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

// 准备记忆篮子
let chatHistory = [];



// 3. 添加消息到页面的函数
function addMessage(text, sender) {
  // --- 新增：时间戳逻辑 ---
  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // 获取最后一条消息的时间（如果有的话）
  const lastTime = chatMessages.dataset.lastTime ? parseInt(chatMessages.dataset.lastTime) : 0;
  const currentTime = now.getTime();
  
  // 如果距离上次发消息超过 10 分钟（或者第一次发），就显示时间
  if (currentTime - lastTime > 10 * 60 * 1000) {
    const timeDiv = document.createElement("div");
    timeDiv.classList.add("time-stamp");
    timeDiv.textContent = timeString;
    chatMessages.appendChild(timeDiv);
  }
  // 更新最后发消息的时间
  chatMessages.dataset.lastTime = currentTime;
  // --- 时间戳逻辑结束 ---

  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", sender); // sender 是 'user' 或 'ai'
  
  const bubbleDiv = document.createElement("div");
  bubbleDiv.classList.add("bubble");
  bubbleDiv.textContent = text;
  
  messageDiv.appendChild(bubbleDiv);
  chatMessages.appendChild(messageDiv);
  
  // 自动滚动到最底部
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 4. 点击发送按钮发生的事
sendButton.addEventListener("click", async () => {
  const text = messageInput.value.trim();
  if (!text) return;

  // 把用户的话显示在右边
  addMessage(text, "user");
  messageInput.value = ""; // 清空输入框
  
  // 把用户的话放进篮子（增加一条记录）
  chatHistory.push({ role: "user", content: text });

  // 显示“正在思考中”的气泡
  const loadingDiv = document.createElement("div");
  loadingDiv.classList.add("message", "ai");
  loadingDiv.innerHTML = '<div class="bubble">正在思考中...</div>';
  chatMessages.appendChild(loadingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // --- 纯净版记忆总结（不打扰用户，后台悄悄进行） ---
  if (chatHistory.length >= 10) {
    loadingDiv.querySelector(".bubble").textContent = "正在整理记忆...";
    
    try {
      // 让 AI 自己总结前面的对话
      const summaryRes = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + API_KEY
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "你是一个记忆提取器。请用简短的一两句话总结下面这段对话中关于用户的核心信息。直接输出总结，不要任何废话。" },
            ...chatHistory
          ]
        })
      });
      const summaryData = await summaryRes.json();
      const summaryText = summaryData.choices[0].message.content;
      
      // 提取你自定义的最高指令（如果有的话）
      let currentSystemPrompt = "";
      if (chatHistory.length > 0 && chatHistory[0].role === "system") {
        currentSystemPrompt = chatHistory[0].content;
      }
      
      // 清空篮子，把“最高指令 + 前情提要”放进去
      chatHistory = [
        { role: "system", content: currentSystemPrompt + " 【前情提要】：" + summaryText }
      ];
      
      loadingDiv.querySelector(".bubble").textContent = "正在思考中...";
    } catch (e) {
      console.log("记忆总结失败，跳过总结", e);
    }
  }

 // --- 正常请求 ---
  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + API_KEY
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: chatHistory
      })
    });

    const data = await response.json();
    const aiReply = data.choices[0].message.content;

    // 把 AI 的回复放进篮子
    chatHistory.push({ role: "assistant", content: aiReply });

    // 替换气泡文字（这里用了 marked.parse 来解析 Markdown 加粗）
    loadingDiv.querySelector(".bubble").innerHTML = marked.parse(aiReply);
    chatMessages.scrollTop = chatMessages.scrollHeight;

  } catch (error) {
    console.error(error);
    loadingDiv.querySelector(".bubble").textContent = "请求失败，请检查 Key 或网络。";
  }
});

// 监听回车键发送
messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault(); 
    sendButton.click(); 
  }
});

// 底部导航切换逻辑
const navTalk = document.getElementById("nav-talk");
const navDesk = document.getElementById("nav-desk");
const navSet = document.getElementById("nav-set");
const chatContainer = document.querySelector(".chat-container");
const deskPage = document.getElementById("desk-page");
const settingsPage = document.getElementById("settings-page"); // 抓住设置页

// 切回日常
navTalk.addEventListener("click", () => {
  navTalk.classList.add("active");
  navDesk.classList.remove("active");
  navSet.classList.remove("active");
  chatContainer.style.display = "flex"; 
  deskPage.style.display = "none";
  settingsPage.style.display = "none"; // 隐藏设置页
});

// 切到书桌
navDesk.addEventListener("click", () => {
  navDesk.classList.add("active");
  navTalk.classList.remove("active");
  navSet.classList.remove("active");
  chatContainer.style.display = "none";
  deskPage.style.display = "flex"; 
  settingsPage.style.display = "none"; // 隐藏设置页
});

// 切到设置
navSet.addEventListener("click", () => {
  navSet.classList.add("active");
  navTalk.classList.remove("active");
  navDesk.classList.remove("active");
  chatContainer.style.display = "none";
  deskPage.style.display = "none";
  settingsPage.style.display = "block"; // 显示设置页
});