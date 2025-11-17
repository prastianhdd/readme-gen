# 🤖 README.md Generator (readme-gen)

Sebuah tool cerdas yang menggunakan AI (Google Gemini) untuk menganalisis repositori GitHub Anda dan secara otomatis membuat draf README.md yang profesional dan siap pakai.

Cukup tempel URL repositori, dan biarkan AI menganalisis kode Anda untuk membuat deskripsi dan daftar fitur secara otomatis.

## Fitur
- Input formulir untuk memasukkan URL repositori GitHub.
- Fungsi untuk memicu generasi README.md otomatis melalui panggilan API.
- Indikator status loading dan penanganan kesalahan untuk umpan balik pengguna.
- Area teks untuk menampilkan dan menyalin output Markdown yang dihasilkan.

## Requirement
- GITHUB_TOKEN
- GEMINI_API_KEY

## Instalasi
```bash
# 1. Clone repositori
git clone https://github.com/prastianhdd/readme-gen.git

# 2. Masuk ke direktori
cd readme-gen

# 3. Install dependencies
npm install
```

## Penggunaan
```bash
npm run dev
```

## Teknologi yang di gunakan
- Frontend: React (Vite)
- Backend: Vercel Serverless Functions (Node.js)
- Styling: CSS Murni (Desain Claymorphism)
- Analisis AI: Google Gemini AI (@google/generative-ai)
- Pengambilan Data: GitHub API
- Platform: Vercel (untuk hosting frontend dan backend serverless)

---
<p align="center">
  <i>✨ Dibuat secara otomatis oleh README.md Generator ✨</i>
</p>
