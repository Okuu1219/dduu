// 抓取设置弹窗里的元素
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const savePromptBtn = document.getElementById("savePromptBtn");
const promptInput = document.getElementById("promptInput");

// 1. 填入你的 DeepSeek API Key
const API_KEY = "sk-5a41f016c7f94e308912fb0e601f5acb";

// 2. 获取网页上的元素
const chatMessages = document.getElementById("chatMessages");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

// 准备记忆篮子
let chatHistory = JSON.parse(localStorage.getItem("myAiChatHistory")) || [];

// 页面加载时，把历史记录显示在屏幕上
window.addEventListener('DOMContentLoaded', () => {
  // 如果篮子里有记忆
  if (chatHistory.length > 0) {
    // 先把界面上默认的“你好”删掉
    chatMessages.innerHTML = ''; 
    
    // 把篮子里的每一句话，都变成气泡
    chatHistory.forEach(msg => {
      // 跳过系统提示词（就是设置里的人设），这个不用显示
      if (msg.role !== 'system') {
        addMessage(msg.content, msg.role === 'user' ? 'user' : 'ai');
      }
    });
  }
});



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
  localStorage.setItem("myAiChatHistory", JSON.stringify(chatHistory));

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
    const response = await fetch("http://1.117.60.110/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ messages: chatHistory })
    });

    const data = await response.json();
    const aiReply = data.reply;

    // 把 AI 的回复放进篮子
    chatHistory.push({ role: "assistant", content: aiReply });
    localStorage.setItem("myAiChatHistory", JSON.stringify(chatHistory));

    // 替换气泡文字
    loadingDiv.querySelector(".bubble").innerHTML = marked.parse(aiReply);

    // 👇👇👇 新增：检查 AI 有没有发暗号 👇👇👇
    if (aiReply.includes("[emoji:")) {
      const match = aiReply.match(/\[emoji:(\d+)\]/);
      if (match) {
        const emojiNum = match[1];
        const imgElement = document.createElement("img");
        imgElement.src = `emojis/${emojiNum}.jpg`; 
        imgElement.style.width = "80px";
        imgElement.style.borderRadius = "10px";
        imgElement.style.display = "block";
        imgElement.style.marginTop = "10px";
        loadingDiv.querySelector(".bubble").appendChild(imgElement);
      }
    }
    
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

// 表情包弹窗逻辑
const cardEmoji = document.getElementById("card-emoji");
const emojiModal = document.getElementById("emoji-modal");
const closeEmojiBtn = document.getElementById("closeEmojiBtn");

if (cardEmoji && emojiModal && closeEmojiBtn) {
  cardEmoji.addEventListener("click", () => {
    // 点击图片，发送到聊天框
const emojiImgs = document.querySelectorAll("#emoji-modal img");
emojiImgs.forEach(img => {
  img.addEventListener("click", () => {
    const imgSrc = img.getAttribute("src");
    
    // 在聊天框里创建一个专属的图片气泡（AI 和 用户都可以用）
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", "user"); // 默认当作用户发送的
    
    // 这里我们不使用文字 bubble，直接放图片
    const imgElement = document.createElement("img");
    imgElement.src = imgSrc;
    imgElement.style.width = "80px";
    imgElement.style.borderRadius = "10px";
    
    messageDiv.appendChild(imgElement);
    chatMessages.appendChild(messageDiv);
    
    // 发送完自动滚到底部，并关闭弹窗
    chatMessages.scrollTop = chatMessages.scrollHeight;
    emojiModal.style.display = "none";
  });
});
    emojiModal.style.display = "flex";
  });

  closeEmojiBtn.addEventListener("click", () => {
    emojiModal.style.display = "none";
  });
}

// 底部面板控制逻辑
const chatPlusBtn = document.getElementById("chatPlusBtn");
const plusPanel = document.getElementById("plus-panel");
const emojiDrawer = document.getElementById("emoji-drawer");

// 点击加号，切换功能面板
if (chatPlusBtn && plusPanel && emojiDrawer) {
  chatPlusBtn.addEventListener("click", () => {
    if (plusPanel.style.display === "none" || plusPanel.style.display === "") {
      plusPanel.style.display = "flex"; // 弹出来
      emojiDrawer.style.display = "none"; // 顺便收起表情
    } else {
      plusPanel.style.display = "none"; // 收回去
    }
  });
}

// 点面板里的“表情”切换出表情包 (供 HTML 的 onclick 调用)
function toggleEmojiDrawer() {
  plusPanel.style.display = "none";
  emojiDrawer.style.display = "flex";
}

// 上传图片并发送到聊天框
const imageInput = document.getElementById("imageInput");

if (imageInput) {
  imageInput.addEventListener("change", async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 1. 在聊天框里显示这张图
    const imgUrl = URL.createObjectURL(file);
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", "user"); 
    const imgElement = document.createElement("img");
    imgElement.src = imgUrl;
    imgElement.style.width = "120px";
    imgElement.style.borderRadius = "10px";
    messageDiv.appendChild(imgElement);
    chatMessages.appendChild(messageDiv);
    
    // 滚到底部，收起面板
    chatMessages.scrollTop = chatMessages.scrollHeight;
    plusPanel.style.display = "none";

    // 2. 显示上传提示
    const loadingDiv = document.createElement("div");
    loadingDiv.classList.add("message", "ai");
    loadingDiv.innerHTML = '<div class="bubble">正在上传图片到服务器...</div>';
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      // 3. 把图片打包发给你的腾讯云
      const formData = new FormData();
      formData.append("image", file);

      const uploadRes = await fetch("http://1.117.60.110/upload", {
        method: "POST",
        body: formData
      });
      const uploadData = await uploadRes.json();

      // 4. 拿到链接，发给 AI
      loadingDiv.querySelector(".bubble").textContent = "正在思考...";
      const finalMessage = "我刚发了一张图片，图片的链接是：" + uploadData.url + " 请根据链接看看这张图。";
      
      messageInput.value = finalMessage;
      sendButton.click();

    } catch (error) {
      console.error(error);
      loadingDiv.querySelector(".bubble").textContent = "图片上传失败了，请检查后端是否启动。";
    }
  });
}

// 清空所有记忆
const clearMemoryBtn = document.getElementById("clearMemoryBtn");
if (clearMemoryBtn) {
  clearMemoryBtn.addEventListener("click", () => {
    // 1. 清空本地的记忆暗格
    localStorage.removeItem("myAiChatHistory");
    // 2. 把篮子倒空
    chatHistory = [];
    // 3. 把屏幕上的气泡也删掉
    chatMessages.innerHTML = `
      <div class="message ai">
        <div class="bubble">记忆已清空，我们重新开始吧！</div>
      </div>
    `;
    alert("记忆已彻底清空！");
  });
}