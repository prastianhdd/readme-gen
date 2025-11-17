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

// Helper (masih sama, versi 2)
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

// --- Handler Utama Serverless Function (Versi 3) ---
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

    // Siapkan header autentikasi
    const headers = {
      'Authorization': `token ${process.env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
    };

    // --- Eksekusi 3 Panggilan API secara Paralel ---
    const [repoRes, pkgRes, envRes] = await Promise.all([
      // 1. Ambil info repo dasar
      fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
      
      // 2. Ambil package.json
      fetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`, { headers }),
      
      // 3. Cek keberadaan .env.example
      fetch(`https://api.github.com/repos/${owner}/${repo}/contents/.env.example`, { method: 'HEAD', headers })
    ]);

    // --- Proses Hasil 1: Info Repo ---
    if (!repoRes.ok) throw new Error('Repositori tidak ditemukan atau GITHUB_TOKEN bermasalah.');
    const repoData = await repoRes.json();
    
    const projectTitle = repoData.name || 'Nama Proyek';
    const description = repoData.description || '(Belum ada deskripsi untuk repositori ini.)';
    const language = repoData.language || 'Tidak terdeteksi';
    const topics = repoData.topics || [];

    // --- Proses Hasil 2: package.json ---
    let installCmd = '(Tidak ada package.json)';
    let usageCmd = '(Tidak ada package.json)';

    if (pkgRes.ok) {
      const pkgData = await pkgRes.json();
      const fileContent = Buffer.from(pkgData.content, 'base64').toString('utf-8');
      const pkgJson = JSON.parse(fileContent);
      const analysis = analyzePackageJson(pkgJson);
      installCmd = analysis.installCmd;
      usageCmd = analysis.usageCmd;
    }

    // --- Proses Hasil 3: .env.example ---
    // Jika 'envRes.ok' (status 200), berarti file ditemukan
    const envExists = envRes.ok;

    // --- Rakit String Markdown Sesuai Template Baru ---
    
    let md = `
# ${projectTitle}

${description}

## Fitur
- Fitur A
- Fitur B
- Fitur C

## Requirement
`;

    if (envExists) {
      md += `
Proyek ini membutuhkan konfigurasi *environment variables*. 
Salin file \`.env.example\` menjadi \`.env\` dan isi variabel yang diperlukan sebelum menjalankan proyek.
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
(Saya tambahkan bagian ini karena sangat penting dan didapat dari \`package.json\`)
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
    console.error(error);
    res.status(500).json({ message: error.message });
  }
}