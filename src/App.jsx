import React, { useState } from 'react';
import './App.css'; // Gunakan file CSS yang sama dari sebelumnya

function App() {
  // State untuk input URL
  const [repoUrl, setRepoUrl] = useState('');
  
  // State untuk menyimpan hasil dari backend
  const [markdownOutput, setMarkdownOutput] = useState('');
  
  // State untuk status loading
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fungsi untuk memanggil backend kita
   */
  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setMarkdownOutput(''); // Kosongkan hasil sebelumnya

    try {
      // Panggil backend (Vercel Serverless Function) kita
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repoUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Terjadi kesalahan');
      }

      // Sukses! Tampilkan hasil dari backend
      setMarkdownOutput(data.markdown);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container" style={{ flexDirection: 'column', maxWidth: '800px' }}>
      
      {/* Bagian Atas: Form Input */}
      <div className="form-section" style={{ width: '100%' }}>
        <h2>Generator README.md Otomatis</h2>

        <div className="form-group">
          <label htmlFor="repo-url">Link Repositori GitHub:</label>
          <p p></p>
          <input
            type="text"
            id="repo-url"
            className="input-field"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/prastianhdd/profile"
          />
        </div>
        
        <button 
          onClick={handleGenerate} 
          disabled={isLoading}
          style={{ padding: '12px', fontSize: '16px' }}
        >
          {isLoading ? 'Menganalisis...' : 'Generate README'}
        </button>
        
        {error && <p style={{ color: 'red', marginTop: '10px' }}>Error: {error}</p>}
      </div>

      {/* Bagian Bawah: Output Markdown */}
      <div className="output-section" style={{ width: '100%' }}>
        <h2>Hasil Markdown (Siap Salin)</h2>
        <textarea
          className="output-textarea"
          style={{ height: '400px' }} // Sesuaikan tinggi
          value={markdownOutput}
          readOnly
          placeholder="Hasil readme md ..."
        />
      </div>
      
    </div>
  );
}

export default App;