// API bazasi URL
const API_BASE_URL = "http://localhost:8000"; // Agar backend boshqa manzilda ishlayotgan bo'lsa, o'zgartiring

// Global o'zgaruvchilar
let currentChatId = null;
let isWaitingForResponse = false;

function logout() {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userPicture");
    alert("Siz tizimdan chiqdingiz.");
    window.location.href = "home.html";
}

window.onload = function() {
    const avatarUrl = localStorage.getItem("userPicture");
    if (avatarUrl) {
        document.getElementById("userAvatar").src = avatarUrl;
    }
};


// new 8-iyun 2025 by deepseek



// DOM elementlari
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.querySelector('.new-chat-btn');
const welcomeMessage = document.querySelector('.welcome-message');
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const sidebar = document.querySelector('.sidebar');
const suggestionButtons = document.querySelectorAll('.suggestion-btn');

// Asosiy welcome HTML
const originalWelcomeHTML = `
    <div class="welcome-message">
        <div class="avatar-large">
            <div class="avatar-inner">N</div>
        </div>
        <h1>Salom, men Nisme</h1>
        <p>Sizga qanday yordam bera olaman?</p>
        <div class="welcome-suggestions">
            <button class="suggestion-btn">YouTube video tarjimasi</button>
          
        </div>
    </div>
`;

// Dastur yuklanganda ishga tushadigan funksiya
document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
    loadChatHistory();
    
    // Agar chat bo'sh bo'lsa, welcome xabarini ko'rsatish
    if (chatContainer.children.length === 0) {
        chatContainer.innerHTML = originalWelcomeHTML;
        setupSuggestionButtons();
    }
});

// Event listenerlarni sozlash
function initEventListeners() {
    // Xabar yuborish
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Textarea o'lchamini avtomatik o'zgartirish
    messageInput.addEventListener('input', autoResizeTextarea);
    
    // Yangi suhbat
    newChatBtn.addEventListener('click', startNewChat);
    
    // Mobil menyu
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleSidebar);
    }
    
    // Sideni yopish (mobil uchun)
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768 && !sidebar.contains(e.target) && e.target !== mobileMenuBtn) {
            sidebar.classList.remove('active');
        }
    });
}

// API bilan ishlash funksiyalari

/**
 * API orqali xabar yuborish va javob olish
 * @param {string} message - Foydalanuvchi xabari
 * @returns {Promise<Object>} - AI javobi va sessiya IDsi
 */
async function sendMessageToAPI(message) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                session_id: currentChatId
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP xatolik! Status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API xatosi:', error);
        return {
            response: "Kechirasiz, hozir javob berolmayapman. Iltimos, keyinroq urinib ko'ring.",
            session_id: currentChatId || generateSessionId()
        };
    }
}

/**
 * Barcha chat sessiyalarini yuklash
 * @returns {Promise<Array>} - Sessiyalar ro'yxati
 */
async function fetchChatSessions() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/sessions`);
        if (!response.ok) {
            throw new Error(`HTTP xatolik! Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Sessiyalarni yuklashda xato:', error);
        return [];
    }
}

/**
 * ID bo'yicha chat sessiyasini yuklash
 * @param {string} sessionId - Sessiya IDsi
 * @returns {Promise<Object>} - Sessiya ma'lumotlari
 */
async function fetchChatSession(sessionId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`);
        if (!response.ok) {
            throw new Error(`HTTP xatolik! Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Sessiyani yuklashda xato:', error);
        return null;
    }
}

// Chat funksiyalari

/**
 * Xabarni yuborish va AI javobini olish
 */
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isWaitingForResponse) return;
    
    // Foydalanuvchi xabarini qo'shish
    addMessageToChat(message, true);
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Welcome xabarini yashirish
    if (welcomeMessage) welcomeMessage.style.display = 'none';
    
    // AI javobi kutayotganligini bildirish
    isWaitingForResponse = true;
    addTypingIndicator();
    
    try {
        // API ga so'rov yuborish
        const { response, session_id } = await sendMessageToAPI(message);
        currentChatId = session_id;
        
        // Typing indikatorini olib tashlash
        removeTypingIndicator();
        
        // AI javobini qo'shish
        addMessageToChat(response, false);
        
        // Chat tarixini yangilash
        loadChatHistory();
    } catch (error) {
        console.error('Xabar yuborishda xato:', error);
        removeTypingIndicator();
        addMessageToChat("Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.", false);
    } finally {
        isWaitingForResponse = false;
    }
}

/**
 * Yangi suhbatni boshlash
 */
function startNewChat() {
    // Animatsiya boshlanishi
    chatContainer.style.opacity = '0';
    
    setTimeout(() => {
        // Chatni tozalash
        chatContainer.innerHTML = originalWelcomeHTML;
        currentChatId = null;
        
        // Inputni tozalash
        messageInput.value = '';
        messageInput.style.height = 'auto';
        
        // Taklif tugmalarini qayta ishga tushirish
        setupSuggestionButtons();
        
        // Animatsiya tugashi
        chatContainer.style.opacity = '1';
        
        // Mobil menyuni yopish
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('active');
        }
    }, 300);
}

/**
 * Chat tarixini yuklash
 */
async function loadChatHistory() {
    try {
        const sessions = await fetchChatSessions();
        const chatHistory = document.querySelector('.chat-history');
        
        // Agar chat history bo'sh bo'lsa, yashirish
        if (!chatHistory) return;
        
        chatHistory.innerHTML = '';
        
        if (sessions.length === 0) {
            chatHistory.innerHTML = '<div class="empty-history">Suhbatlar tarixi bo\'sh</div>';
            return;
        }
        
        sessions.forEach(session => {
            const chatElement = document.createElement('div');
            chatElement.className = 'chat-history-item';
            chatElement.dataset.sessionId = session.session_id;
            
            // Agar bu hozirgi suhbat bo'lsa, aktiv qilish
            if (session.session_id === currentChatId) {
                chatElement.classList.add('active');
            }
            
            chatElement.innerHTML = `
                <div class="chat-history-title">${session.title}</div>
                <div class="chat-history-time">${formatDate(session.created_at)}</div>
            `;
            
            chatElement.addEventListener('click', () => loadChat(session.session_id));
            chatHistory.appendChild(chatElement);
        });
    } catch (error) {
        console.error('Chat tarixini yuklashda xato:', error);
    }
}

/**
 * Sessiyani yuklash
 * @param {string} sessionId - Yuklash kerak bo'lgan sessiya IDsi
 */
async function loadChat(sessionId) {
    try {
        const session = await fetchChatSession(sessionId);
        if (!session) return;
        
        // Chatni tozalash
        chatContainer.innerHTML = '';
        currentChatId = sessionId;
        
        // Xabarlarni qo'shish
        session.messages.forEach(msg => {
            addMessageToChat(msg.text, msg.is_user, msg.timestamp);
        });
        
        // Welcome xabarini yashirish
        if (welcomeMessage) welcomeMessage.style.display = 'none';
        
        // Chat tarixini yangilash
        loadChatHistory();
        
        // Mobil menyuni yopish
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('active');
        }
    } catch (error) {
        console.error('Sessiyani yuklashda xato:', error);
        addMessageToChat("Suhbatni yuklashda xatolik yuz berdi.", false);
    }
}

// Yordamchi funksiyalar

/**
 * Chatga xabar qo'shish
 * @param {string} text - Xabar matni
 * @param {boolean} isUser - Foydalanuvchi xabari bo'lsa true
 * @param {string} [timestamp] - Xabar vaqti (ixtiyoriy)
 */
function addMessageToChat(text, isUser, timestamp) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    
    // Agar vaqt ko'rsatilgan bo'lsa
    if (timestamp) {
        const timeElement = document.createElement('div');
        timeElement.className = 'message-time';
        timeElement.textContent = formatDate(timestamp);
        messageDiv.appendChild(timeElement);
    }
    
    const textElement = document.createElement('div');
    textElement.className = 'message-text';
    textElement.textContent = text;
    messageDiv.appendChild(textElement);
    
    chatContainer.appendChild(messageDiv);
    
    // Avtomatik pastga scroll qilish
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Tayyorlanayotganlik indikatorini qo'shish
 */
function addTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai-message typing-indicator';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = `
        <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    chatContainer.appendChild(typingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Tayyorlanayotganlik indikatorini olib tashlash
 */
function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

/**
 * Textarea o'lchamini avtomatik o'zgartirish
 */
function autoResizeTextarea() {
    this.style.height = 'auto';
    const maxHeight = window.innerHeight * 0.3; // 30% ekran balandligi
    const newHeight = Math.min(this.scrollHeight, maxHeight);
    this.style.height = newHeight + 'px';
}

/**
 * Sana vaqtni formatlash
 * @param {string} dateString - ISO formatdagi sana
 * @returns {string} - Formatlangan sana (e.g. "12:30, 15.05.2023")
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + 
           ', ' + date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Taklif tugmalarini ishga tushirish
 */
function setupSuggestionButtons() {
    document.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            messageInput.value = this.textContent;
            messageInput.focus();
        });
    });
}

/**
 * Mobil menyuni ko'rsatish/yashirish
 */
function toggleSidebar() {
    sidebar.classList.toggle('active');
}

/**
 * Yangi sessiya ID generatsiya qilish
 * @returns {string} - Yangi sessiya IDsi
 */
function generateSessionId() {
    return Date.now().toString();
}