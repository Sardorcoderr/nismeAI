from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid
import openai
import os




from fastapi import FastAPI, Request
from authlib.integrations.starlette_client import OAuth
from starlette.responses import RedirectResponse
from starlette.middleware.sessions import SessionMiddleware
import os
from dotenv import load_dotenv








load_dotenv()

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SESSION_SECRET_KEY"))

oauth = OAuth()
oauth.register(
    name='google',
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    access_token_url='https://oauth2.googleapis.com/token',
    authorize_url='https://accounts.google.com/o/oauth2/auth',
    api_base_url='https://www.googleapis.com/oauth2/v1/',
    client_kwargs={'scope': 'openid email profile'},
)

@app.get("/")
async def root():
    return {"message": "Welcome! Visit /login to sign in with Google"}

@app.get("/login")
async def login(request: Request):
    redirect_uri = request.url_for('auth')
    return await oauth.google.authorize_redirect(request, redirect_uri)

@app.get("/auth")
async def auth(request: Request):
    token = await oauth.google.authorize_access_token(request)
    user = await oauth.google.parse_id_token(request, token)
    return {"user": user}













# .env fayl orqali API kalitlarni yuklash
from dotenv import load_dotenv
load_dotenv()

openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI(
    title="Nisme AI API",
    description="Nisme AI uchun GPT-3.5 Turbo asosidagi backend",
    version="1.0.0"
)

# CORS sozlamalari (frontend bilan ishlashi uchun)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Xavfsizlik uchun kerak bo‘lsa o‘zgartiring
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔹 Model: Foydalanuvchi xabari
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class Message(BaseModel):
    text: str
    is_user: bool
    timestamp: str

class ChatResponse(BaseModel):
    response: str
    session_id: str
    timestamp: str

class ChatSession(BaseModel):
    session_id: str
    created_at: str
    title: str
    messages: List[Message]

# 🔹 Vaqtinchalik bazamiz (RAM ichida)
chat_sessions = {}

@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_ai(request: ChatRequest):
    """AI ga savol yuborish va javob olish"""
    try:
        # Yangi yoki mavjud sessiyani aniqlash
        if not request.session_id or request.session_id not in chat_sessions:
            session_id = str(uuid.uuid4())
            chat_sessions[session_id] = {
                "created_at": datetime.now().isoformat(),
                "title": request.message[:30],
                "messages": []
            }
        else:
            session_id = request.session_id

        # Xabarni sessiyaga qo‘shish
        chat_sessions[session_id]["messages"].append({
            "text": request.message,
            "is_user": True,
            "timestamp": datetime.now().isoformat()
        })

        # AI javobi
        response = await generate_ai_response(session_id)

        return ChatResponse(
            response=response,
            session_id=session_id,
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Xatolik: {str(e)}")

async def generate_ai_response(session_id: str) -> str:
    """OpenAI orqali AI javobini generatsiya qilish"""
    history = chat_sessions[session_id]["messages"][-6:]

    messages = [
        {"role": "system", "content": "Siz Nisme AI siz. Har doim foydalanuvchiga do'stona va professional ohangda javob bering."}
    ]

    for msg in history:
        role = "user" if msg["is_user"] else "assistant"
        messages.append({"role": role, "content": msg["text"]})

    try:
        completion = await openai.ChatCompletion.acreate(
            model="gpt-3.5-turbo",
            messages=messages,
            temperature=0.7,
            max_tokens=1000
        )
        reply = completion.choices[0].message["content"]

        # AI xabarini sessiyaga qo‘shish
        chat_sessions[session_id]["messages"].append({
            "text": reply,
            "is_user": False,
            "timestamp": datetime.now().isoformat()
        })

        return reply
    except openai.error.OpenAIError as e:
        return f"AI xatosi: {str(e)}"

@app.get("/api/sessions", response_model=List[ChatSession])
async def list_sessions():
    """Barcha sessiyalarni qaytarish"""
    return [
        ChatSession(
            session_id=sid,
            created_at=sess["created_at"],
            title=sess["title"],
            messages=sess["messages"]
        )
        for sid, sess in chat_sessions.items()
    ]

@app.get("/api/sessions/{session_id}", response_model=ChatSession)
async def get_session(session_id: str):
    """ID bo‘yicha sessiya olish"""
    if session_id not in chat_sessions:
        raise HTTPException(status_code=404, detail="Sessiya topilmadi")
    sess = chat_sessions[session_id]
    return ChatSession(
        session_id=session_id,
        created_at=sess["created_at"],
        title=sess["title"],
        messages=sess["messages"]
    )

@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    """Sessiyani o‘chirish"""
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    return {"message": "Sessiya o‘chirildi"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
