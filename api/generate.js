import { GoogleGenerativeAI } from "@google/generative-ai";

// Helper (masih sama)
function parseRepoUrl(url) {
  try {
    const { pathname } = new URL(url);
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length < 2) throw new Error('URL tidak valid');
    return { owner: parts[0], repo: parts[1] };
  } catch (error) {
    throw new Error('Format URL GitHub tidak valid.');
  }
}

// Helper (masih sama)
function analyzePackageJson(pkgJson) {
  const scripts = pkgJson.scripts || {};
  let installCmd = 'npm install';
  let usageCmd = 'Tidak ada skrip `dev` atau `start` yang ditemukan.';

  if (scripts.dev) usageCmd = 'npm run dev';
  else if (scripts.start) usageCmd = 'npm run start';

  if (pkgJson.packageManager && pkgJson.packageManager.startsWith('yarn')) {
    installCmd = 'yarn install';
    usageCmd = usageCmd.replace('npm run', 'yarn');
  } else if (pkgJson.packageManager && pkgJson.packageManager.startsWith('pnpm')) {
    installCmd = 'pnpm install';
    usageCmd = usageCmd.replace('npm run', 'pnpm');
  }

  return { installCmd, usageCmd };
}

// --- FUNGSI BARU UNTUK MEMANGGIL AI ---
async function analyzeCodeWithAI(codeContent) {
  try {
    // 1. Inisialisasi AI dengan Kunci API dari Environment Variables
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    // 2. Prompt Engineering: Instruksi untuk AI
    const prompt = `
      Anda adalah seorang penulis teknis ahli yang bertugas menganalisis kode sumber.
      Tugas Anda adalah menghasilkan deskripsi proyek dan daftar fitur utama.
      
      Aturan:
      1. Balas HANYA dengan objek JSON yang valid.
      2. Objek JSON harus memiliki dua kunci: "description" (string) dan "features" (array string).
      3. "description" harus berupa deskripsi proyek 1-2 kalimat yang ringkas dan menarik.
      4. "features" harus berupa array berisi 3-5 string, di mana setiap string adalah fitur utama yang terdeteksi dari kode.
      5. Jangan sertakan markdown \`\`\`json atau teks lain di luar objek JSON.

      Berikut adalah kode sumbernya:
      --- KODE MULAI ---
      ${codeContent}
      --- KODE SELESAI ---
    `;

    // 3. Hasilkan konten
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 4. Parsing respons JSON dari AI
    // Membersihkan jika AI secara tidak sengaja membungkusnya dalam markdown
    const jsonString = text.replace(/^```json\n/, '').replace(/\n```$/, '');
    return JSON.parse(jsonString); // Mengembalikan { description: "...", features: ["..."] }

  } catch (error) {
    console.error("Kesalahan Analisis AI:", error);
    // Jika AI gagal, kembalikan null agar kita bisa lanjut tanpa AI
    return null;
  }
}

// --- Handler Utama Serverless Function (Versi 4) ---
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metode tidak diizinkan' });
  }

  try {
    const { repoUrl } = req.body;
    if (!repoUrl) {
      return res.status(400).json({ message: 'repoUrl diperlukan' });
    }

    const { owner, repo } = parseRepoUrl(repoUrl);

    // Siapkan header autentikasi GitHub
    const headers = {
      'Authorization': `token ${process.env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
    };

    // --- Eksekusi Panggilan API Paralel (termasuk file kode) ---
    const [repoRes, pkgRes, envRes, codeRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`, { headers }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/contents/.env.example`, { method: 'HEAD', headers }),
      // Mencoba mengambil file kode utama (ASUMSI)
      fetch(`https://api.github.com/repos/${owner}/${repo}/contents/src/App.jsx`, { headers })
    ]);

    // --- Proses Hasil 1: Info Repo ---
    if (!repoRes.ok) throw new Error('Repositori tidak ditemukan atau GITHUB_TOKEN bermasalah.');
    const repoData = await repoRes.json();
    const projectTitle = repoData.name || 'Nama Proyek';
    let description = repoData.description; // Deskripsi GitHub (mungkin kosong)
    const language = repoData.language || 'Tidak terdeteksi';
    const topics = repoData.topics || [];

    // --- Proses Hasil 2: package.json ---
    let installCmd = '(Tidak ada package.json)';
    let usageCmd = '(Tidak ada package.json)';
    let pkgJson = {};

    if (pkgRes.ok) {
      const pkgData = await pkgRes.json();
      const fileContent = Buffer.from(pkgData.content, 'base64').toString('utf-8');
      pkgJson = JSON.parse(fileContent);
      const analysis = analyzePackageJson(pkgJson);
      installCmd = analysis.installCmd;
      usageCmd = analysis.usageCmd;
    }
    
    // --- Logika Deskripsi Fallback (sebelum AI) ---
    if (!description && pkgJson.description) {
      description = pkgJson.description; // Fallback ke deskripsi package.json
    } else if (!description) {
      description = '(Belum ada deskripsi untuk repositori ini.)';
    }
    
    // --- Proses Hasil 3: .env.example ---
    const envExists = envRes.ok;

    // --- Proses Hasil 4: Analisis AI ---
    let aiDescription = null;
    let aiFeatures = [];

    if (codeRes.ok) {
      const codeData = await codeRes.json();
      const codeContent = Buffer.from(codeData.content, 'base64').toString('utf-8');
      
      // Panggil fungsi AI baru kita
      const aiAnalysis = await analyzeCodeWithAI(codeContent);
      
      if (aiAnalysis) {
        aiDescription = aiAnalysis.description;
        aiFeatures = aiAnalysis.features;
      }
    }

    // --- Rakit String Markdown (Menggunakan Data AI) ---
    
    // Prioritas Deskripsi: 1. AI, 2. GitHub, 3. package.json, 4. Fallback
    const finalDescription = aiDescription || description;

    let md = `
# ${projectTitle}

${finalDescription}

## Fitur
`;

    // Gunakan fitur dari AI jika ada, jika tidak, gunakan placeholder
    if (aiFeatures.length > 0) {
      md += aiFeatures.map(feature => `- ${feature}`).join('\n');
    } else {
      md += `
- Fitur A
- Fitur B
- Fitur C
`;
    }

    md += `
## Requirement
`;

    if (envExists) {
      md += `
Proyek ini membutuhkan konfigurasi *environment variables*. 
Salin file \`.env.example\` menjadi \`.env\` dan isi variabel yang diperlukan.
\`\`\`bash
cp .env.example .env
\`\`\`
`;
    } else {
      md += `
Tidak ada *requirement* atau konfigurasi \`.env\` khusus yang terdeteksi.
`;
    }

    md += `
## Instalasi
\`\`\`bash
# 1. Clone repositori
git clone ${repoData.clone_url}

# 2. Masuk ke direktori
cd ${projectTitle}

# 3. Install dependencies
${installCmd}
\`\`\`

## Penggunaan
\`\`\`bash
${usageCmd}
\`\`\`

## Teknologi yang di gunakan
- **Bahasa Utama:** ${language}
- **Topik Terkait:** ${topics.length > 0 ? topics.map(t => `\`${t}\``).join(', ') : 'Tidak ada topik'}
`;

    md += `
---
<p align="center">
  <i>✨ Dibuat secara otomatis oleh README.md Generator ✨</i>
</p>
    `;

    // Kirim hasil akhir kembali ke frontend
    res.status(200).json({ markdown: md.trim() });

  } catch (error) {
    console.error("Kesalahan Handler Utama:", error.message);
    res.status(500).json({ message: error.message });
  }
}