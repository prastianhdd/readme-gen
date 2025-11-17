// Helper untuk mem-parsing URL GitHub
function parseRepoUrl(url) {
  try {
    const { pathname } = new URL(url);
    const parts = pathname.split('/').filter(Boolean); // Hapus spasi kosong
    if (parts.length < 2) throw new Error('URL tidak valid');
    return { owner: parts[0], repo: parts[1] };
  } catch (error) {
    throw new Error('Format URL GitHub tidak valid.');
  }
}

// Helper untuk menganalisis package.json
function analyzePackageJson(pkgJson) {
  const scripts = pkgJson.scripts || {};
  
  // Logika cerdas untuk menentukan perintah
  // (Bisa dikembangkan lebih lanjut)
  const installCmd = (pkgJson.dependencies || pkgJson.devDependencies) ? 'npm install' : 'Tidak ada dependensi yang perlu diinstal.';
  const usageCmd = scripts.dev || scripts.start || 'Silakan periksa script package.json untuk perintah penggunaan.';

  return { installCmd, usageCmd };
}

// Handler utama Serverless Function
export default async function handler(req, res) {
  // Hanya izinkan metode POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metode tidak diizinkan' });
  }

  try {
    const { repoUrl } = req.body;
    if (!repoUrl) {
      return res.status(400).json({ message: 'repoUrl diperlukan' });
    }

    const { owner, repo } = parseRepoUrl(repoUrl);

    // Header untuk autentikasi GitHub API (SANGAT PENTING untuk menghindari rate limit)
    // Anda harus membuat GITHUB_TOKEN di Akun GitHub Anda dan menambahkannya ke Vercel Environment Variables
    const headers = {
      'Authorization': `token ${process.env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
    };

    // --- Panggilan API 1: Dapatkan Info Dasar Repositori ---
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!repoRes.ok) throw new Error('Repositori tidak ditemukan.');
    const repoData = await repoRes.json();

    const projectTitle = repoData.name || 'Nama Proyek';
    const description = repoData.description || 'Tidak ada deskripsi.';

    // --- Panggilan API 2: Dapatkan file package.json ---
    let installCmd = 'npm install'; // Default
    let usageCmd = 'npm run dev'; // Default

    try {
      const pkgRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`, { headers });
      if (pkgRes.ok) {
        const pkgData = await pkgRes.json();
        // Konten file dari GitHub API di-encode dalam Base64
        const fileContent = Buffer.from(pkgData.content, 'base64').toString('utf-8');
        const pkgJson = JSON.parse(fileContent);
        
        // Analisis file package.json
        const analysis = analyzePackageJson(pkgJson);
        installCmd = analysis.installCmd;
        usageCmd = analysis.usageCmd;
      }
    } catch (pkgError) {
      // Abaikan jika package.json tidak ada, gunakan default
      console.warn('Tidak dapat menemukan atau mem-parsing package.json:', pkgError.message);
    }

    // --- Rakit String Markdown ---
    const generatedMarkdown = `
# ${projectTitle}

## 📝 Deskripsi
${description}

## 🚀 Instalasi
\`\`\`bash
${installCmd}
\`\`\`

## 💻 Penggunaan
\`\`\`bash
${usageCmd}
\`\`\`

## 📄 Lisensi
Proyek ini dilisensikan di bawah Lisensi ${repoData.license ? repoData.license.name : 'MIT'}.
    `;

    // Kirim hasil akhir kembali ke frontend
    res.status(200).json({ markdown: generatedMarkdown.trim() });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}