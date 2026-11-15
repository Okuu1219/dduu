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
    // 如果篮子里没有 system 指令，就不发；有就一起发
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + API_KEY
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: chatHistory // 把整个篮子发过去
      })
    });

    const data = await response.json();
    const aiReply = data.choices[0].message.content;

    // 把 AI 的回复放进篮子
    chatHistory.push({ role: "assistant", content: aiReply });

    // 替换气泡文字
    loadingDiv.querySelector(".bubble").textContent = aiReply;
    chatMessages.scrollTop = chatMessages.scrollHeight;

  } catch (error) {
    console.error(error);
    loadingDiv.querySelector(".bubble").textContent = "请求失败，请检查 Key 或网络。";
  }
});

// --- 设置弹窗逻辑 ---
settingsBtn.addEventListener("click", () => {
  // 如果篮子里有系统提示词，就显示出来；如果没有，就显示空白
  if (chatHistory.length > 0 && chatHistory[0].role === "system") {
    promptInput.value = chatHistory[0].content;
  } else {
    promptInput.value = ""; 
  }
  settingsModal.style.display = "flex";
});

closeModalBtn.addEventListener("click", () => {
  settingsModal.style.display = "none";
});

savePromptBtn.addEventListener("click", () => {
  const newPrompt = promptInput.value.trim();
  
  // 找到篮子里现有的系统指令，如果没有就新建一个
  const systemIndex = chatHistory.findIndex(m => m.role === "system");
  if (systemIndex !== -1) {
    chatHistory[systemIndex].content = newPrompt;
  } else if (newPrompt !== "") {
    chatHistory.unshift({ role: "system", content: newPrompt });
  } else {
    // 如果用户清空了输入框，就把系统指令删掉
    if (systemIndex !== -1) chatHistory.splice(systemIndex, 1);
  }
  
  alert("指令已保存！");
  settingsModal.style.display = "none";
});