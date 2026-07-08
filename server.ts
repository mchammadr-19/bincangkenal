import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middlewares to parse JSON bodies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API route /api/generate
  app.post("/api/generate", async (req, res) => {
    const sysPrompt = `Kamu adalah Game Master permainan kartu Bincang Kenal. Buatkan pertanyaan seru berbahasa Indonesia.
Deep Talk: personal, tentang memori, hidup, pertemanan, pekerjaan, pengalaman.
SANGAT PENTING: Buatlah pertanyaan yang SANGAT UNIK, simpel, dan belum pernah terpikirkan sebelumnya. Jangan gunakan pertanyaan klise/pasaran. Pastikan 100% tidak ada satupun pertanyaan yang mirip satu sama lain secara makna.
BATASAN TEKS: Setiap pertanyaan WAJIB di bawah 120 karakter agar muat di dalam kartu.
PENTING: Output WAJIB berupa JSON valid dengan struktur persis seperti ini: {"questions": ["..."], "votes": []}. Jangan tambahkan teks markdown seperti \`\`\`json.`;
    
    const userPrompt = "Buatkan 35 pertanyaan Deep Talk yang 100% baru, sangat anti-mainstream, dan berbeda dari yang sebelumnya.";
    let errorLogs = "";

    // --- 1. COBA GROQ AI (Tercepat) ---
    if (process.env.GROQ_API_KEY) {
      try {
        const resGroq = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
          body: JSON.stringify({
            model: "llama3-8b-8192",
            messages: [{ role: "system", content: sysPrompt }, { role: "user", content: userPrompt }],
            response_format: { type: "json_object" }
          })
        });
        if (resGroq.ok) {
          const data = await resGroq.json() as any;
          const parsed = JSON.parse(data.choices[0].message.content);
          if (parsed.questions && parsed.votes) {
            res.status(200).json({ ...parsed, provider: 'Groq' });
            return;
          }
        } else {
          errorLogs += `Groq (${resGroq.status}). `;
        }
      } catch (e) {
        errorLogs += `Groq Error. `;
      }
    } else {
      errorLogs += `No Groq Key. `;
    }

    // --- 2. COBA OPENAI (Paling Stabil) ---
    if (process.env.OPENAI_API_KEY) {
      try {
        const resOai = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: sysPrompt }, { role: "user", content: userPrompt }],
            response_format: { type: "json_object" }
          })
        });
        if (resOai.ok) {
          const data = await resOai.json() as any;
          const parsed = JSON.parse(data.choices[0].message.content);
          if (parsed.questions && parsed.votes) {
            res.status(200).json({ ...parsed, provider: 'OpenAI' });
            return;
          }
        } else {
          errorLogs += `OpenAI (${resOai.status}). `;
        }
      } catch (e) {
        errorLogs += `OpenAI Error. `;
      }
    } else {
      errorLogs += `No OpenAI Key. `;
    }

    // --- 3. COBA GEMINI (Pintar & Powerful) ---
    if (process.env.GEMINI_API_KEY) {
      try {
        const resGem = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sysPrompt }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });
        if (resGem.ok) {
          const data = await resGem.json() as any;
          const parsed = JSON.parse(data.candidates[0].content.parts[0].text);
          if (parsed.questions && parsed.votes) {
            res.status(200).json({ ...parsed, provider: 'Gemini' });
            return;
          }
        } else {
          errorLogs += `Gemini (${resGem.status}). `;
        }
      } catch (e) {
        errorLogs += `Gemini Error. `;
      }
    } else {
      errorLogs += `No Gemini Key. `;
    }

    // Jika kode sampai di sini, berarti KETIGA AI gagal berfungsi
    res.status(500).json({ error: `Semua AI (Groq, OpenAI, Gemini) gagal memproses. Log: ${errorLogs}` });
  });

  // Serve static assets (like logo.png) from root directory directly
  app.use(express.static(path.join(process.cwd(), '.')));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
