
/* ------------------------------
   GLOBAL STATE
------------------------------- */
let chats = [];            // all chats
let activeChatId = null;   // currently open chat id

/* ------------------------------
   BOOTSTRAP ON LOAD
------------------------------- */
window.addEventListener("load", () => {
    loadChats();
    if (!activeChatId) createNewChat();
    showChatList();
    loadActiveChat();
});

/* ------------------------------
   STORAGE HELPERS
------------------------------- */
function saveChats() {
    const payload = { chats, activeChatId };
    localStorage.setItem("chatbot_chats", JSON.stringify(payload));
}

function loadChats() {
    try {
        const raw = localStorage.getItem("chatbot_chats");
        if (raw) {
            const data = JSON.parse(raw);
            chats = data.chats || [];
            activeChatId = data.activeChatId || null;
        } else {
            chats = [];
            activeChatId = null;
        }
    } catch (e) {
        console.error("Failed to load chats:", e);
        chats = [];
        activeChatId = null;
    }
}

/* ------------------------------
   CREATE NEW CHAT
------------------------------- */
function createNewChat() {
    const newChat = {
        id: "chat-" + Date.now(),
        title: "New Chat",
        createdAt: Date.now(),
        messages: []
    };
    // put newest on top
    chats.unshift(newChat);
    activeChatId = newChat.id;
    saveChats();
    showChatList();
    loadActiveChat();
}

/* ------------------------------
   SHOW CHAT LIST
------------------------------- */
function showChatList() {
    const chatList = document.getElementById("chat-list");
    if (!chatList) return;
    chatList.innerHTML = "";

    chats.forEach(chat => {
        const item = document.createElement("div");
        item.className = "chat-item" + (chat.id === activeChatId ? " active" : "");

        // Title (click to open)
        const title = document.createElement("div");
        title.className = "chat-title";
        title.innerText = chat.title;
        title.title = chat.title;
        title.onclick = () => {
            activeChatId = chat.id;
            saveChats();
            showChatList();
            loadActiveChat();
        };

        // Action icons container
        const actions = document.createElement("div");
        actions.className = "actions";

        // Rename icon
        const renameBtn = document.createElement("span");
        renameBtn.className = "icon-btn";
        renameBtn.innerText = "✎";
        renameBtn.title = "Rename chat";
        renameBtn.onclick = (e) => {
            e.stopPropagation();
            renameChatFromList(chat.id);
        };

        // Delete icon
        const deleteBtn = document.createElement("span");
        deleteBtn.className = "icon-btn";
        deleteBtn.innerText = "🗑";
        deleteBtn.title = "Delete chat";
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteChatFromList(chat.id);
        };

        actions.appendChild(renameBtn);
        actions.appendChild(deleteBtn);

        item.appendChild(title);
        item.appendChild(actions);

        chatList.appendChild(item);
    });
}

/* ------------------------------
   LOAD ACTIVE CHAT MESSAGES INTO UI
------------------------------- */
function loadActiveChat() {
    const area = document.getElementById("chat-area");
    const titleEl = document.getElementById("chat-title");
    if (!area || !titleEl) return;

    area.innerHTML = "";

    const chat = chats.find(c => c.id === activeChatId);
    if (!chat) {
        titleEl.innerText = "New Chat";
        return;
    }

    titleEl.innerText = chat.title || "Chat";

    chat.messages.forEach(msg => {
        addMessageToUI(msg.text, msg.sender);
    });

    area.scrollTop = area.scrollHeight;
}

/* ------------------------------
   ADD MESSAGE TO UI and optionally save
   sender = "user" or "bot"
------------------------------- */
function addMessage(text, sender, save = true) {
    const chat = chats.find(c => c.id === activeChatId);
    if (!chat) return;

    if (save) {
        chat.messages.push({ sender, text, time: Date.now() });
        saveChats();
    }

    addMessageToUI(text, sender);
}

function addMessageToUI(text, sender) {
    const area = document.getElementById("chat-area");
    if (!area) return;

    const msg = document.createElement("div");
    msg.className = "message " + sender;
    msg.innerText = text;

    area.appendChild(msg);
    area.scrollTop = area.scrollHeight;
}

/* ------------------------------
   SEND MESSAGE (user -> backend)
------------------------------- */
function sendMessage() {
    const input = document.getElementById("user-input");
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    // Save user message immediately
    addMessage(text, "user", true);
    input.value = "";

    // Add typing indicator (temporary, not saved)
    const typing = document.createElement("div");
    typing.className = "message bot";
    typing.innerText = "Typing...";
    typing.dataset.typing = "1";
    document.getElementById("chat-area").appendChild(typing);
    document.getElementById("chat-area").scrollTop = document.getElementById("chat-area").scrollHeight;

    // POST to backend
    fetch("/chat", {                          // relative path to avoid CORS issues
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
    })
    .then(async res => {
        if (!res.ok) throw new Error("Network response not ok");
        return res.json();
    })
    .then(data => {
        // remove typing bubble
        const area = document.getElementById("chat-area");
        const lastTyping = area.querySelector('div[data-typing="1"]');
        if (lastTyping) lastTyping.remove();

        const reply = (data && data.reply) ? data.reply : "Sorry, no reply.";
        addMessage(reply, "bot", true);
    })
    .catch(err => {
        console.error("Chat error:", err);
        const area = document.getElementById("chat-area");
        const lastTyping = area.querySelector('div[data-typing="1"]');
        if (lastTyping) lastTyping.remove();
        addMessage("Error: Could not get reply.", "bot", true);
    });
}

/* ------------------------------
   ENTER to send
------------------------------- */
document.addEventListener("keydown", e => {
    // avoid sending when focus is not on input to reduce accidental submits
    if (e.key === "Enter") {
        const el = document.activeElement;
        const input = document.getElementById("user-input");
        if (el === input) {
            e.preventDefault();
            sendMessage();
        }
    }
});

/* ------------------------------
   RENAME & DELETE from sidebar (icons)
------------------------------- */
function renameChatFromList(id) {
    const chat = chats.find(c => c.id === id);
    if (!chat) return;
    const newName = prompt("Enter new chat name:", chat.title || "Chat");
    if (newName && newName.trim()) {
        chat.title = newName.trim();
        saveChats();
        showChatList();
        if (activeChatId === id) loadActiveChat();
    }
}

function deleteChatFromList(id) {
    if (!confirm("Delete this chat?")) return;

    chats = chats.filter(c => c.id !== id);

    if (chats.length === 0) {
        createNewChat();
    } else {
        if (!chats.find(c => c.id === activeChatId)) {
            activeChatId = chats[0].id;
        }
    }

    saveChats();
    showChatList();
    loadActiveChat();
}

/* ------------------------------
   TOP-HEADER RENAME/DELETE (kept for backward compatibility)
   These functions simply call the sidebar versions
------------------------------- */
function renameChat() {
    if (!activeChatId) return;
    renameChatFromList(activeChatId);
}
function deleteChat() {
    if (!activeChatId) return;
    deleteChatFromList(activeChatId);
}

/* ------------------------------
   SETTINGS & ABOUT placeholders
------------------------------- */
function openSettings() {
    alert("Settings are coming soon.");
}
function openAbout() {
    alert("AI Chatbot by Harsh.");
}

/* ------------------------------
   OPTIONAL: export / import helpers (small utility)
   You can expand these later.
------------------------------- */
function exportChat(id) {
    const chat = chats.find(c => c.id === id);
    if (!chat) return;
    const blob = new Blob([JSON.stringify(chat, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (chat.title || "chat") + ".json";
    a.click();
    URL.revokeObjectURL(url);
}

function importChat(jsonStr) {
    try {
        const obj = JSON.parse(jsonStr);
        if (!obj.id) obj.id = "chat-" + Date.now();
        chats.unshift(obj);
        activeChatId = obj.id;
        saveChats();
        showChatList();
        loadActiveChat();
    } catch (e) {
        alert("Invalid chat JSON");
    }
}
