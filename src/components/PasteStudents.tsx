import { useState } from 'react';
import { X, Clipboard, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PasteStudentsProps {
  onClose: () => void;
  onSuccess: () => void;
  selectedProgramme: string;
}

export function PasteStudents({ onClose, onSuccess, selectedProgramme }: PasteStudentsProps) {
  const [pastedData, setPastedData] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!pastedData.trim()) {
      setError('Please paste some data first');
      return;
    }

    if (!selectedProgramme || selectedProgramme === 'all') {
      setError('Please select a programme first');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Parse tab-separated or newline-separated data from Excel
      // Excel usually pastes as: Name[TAB]Email[NEWLINE]
      const rows = pastedData.split(/\r?\n/).filter(row => row.trim());
      const students: { name: string; email: string | null }[] = [];
      const seenEmailsInPaste = new Set<string>();

      for (const row of rows) {
        // Split by Tab or Comma
        const columns = row.split(/\t|,/);
        if (columns.length >= 1) {
          const name = columns[0].trim();
          const email = columns[1] ? columns[1].trim().toLowerCase() : null;

          if (name) {
            if (email && seenEmailsInPaste.has(email)) continue;
            
            students.push({ name, email });
            if (email) seenEmailsInPaste.add(email);
          }
        }
      }

      if (students.length === 0) {
        setError('No valid students found. Ensure you copy at least the Name column.');
        setUploading(false);
        return;
      }

      // Fetch existing students for this programme to check for duplicates by name and email
      const { data: existingStudents, error: fetchError } = await supabase
        .from('students')
        .select('name, email')
        .eq('programme_id', selectedProgramme);

      if (fetchError) throw fetchError;

      const existingSet = new Set(existingStudents?.map(s => `${s.name.toLowerCase().trim()}|${s.email?.toLowerCase().trim() || ''}`) || []);
      
      const newStudents = students.filter(s => {
        const key = `${s.name.toLowerCase().trim()}|${s.email?.toLowerCase().trim() || ''}`;
        return !existingSet.has(key);
      });
      const duplicateCount = students.length - newStudents.length;

      if (newStudents.length === 0) {
        setError(`All students are already registered (${duplicateCount} duplicates found).`);
        setUploading(false);
        return;
      }

      const { error: insertError } = await supabase
        .from('students')
        .insert(
          newStudents.map(s => ({
            name: s.name,
            email: s.email,
            programme_id: selectedProgramme
          }))
        );

      if (insertError) throw insertError;

      setSuccess(`Successfully added ${newStudents.length} new students. ${duplicateCount > 0 ? `${duplicateCount} duplicates skipped.` : ''}`);
      setTimeout(() => {
        onSuccess();
      }, 2500);
    } catch (err: any) {
      console.error('Paste error:', err);
      setError(err.message || 'Failed to add students');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-8 relative overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-[#e51836]/10 rounded-lg">
            <Clipboard className="w-6 h-6 text-[#e51836]" />
          </div>
          <h2 className="text-2xl font-bold text-[#091838]">Paste from Excel</h2>
        </div>

        <p className="text-gray-500 mb-6 text-sm">
          Copy the <strong>Name</strong> and <strong>Email</strong> columns from your Excel or Google Sheet and paste them here.
        </p>

        <textarea
          value={pastedData}
          onChange={(e) => setPastedData(e.target.value)}
          placeholder="John Doe	john@example.com&#10;Jane Smith	jane@example.com"
          className="w-full h-64 p-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#e51836] focus:border-transparent transition-all font-mono text-sm mb-6 bg-gray-50"
        />

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg mb-6 border border-red-100">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-4 bg-green-50 text-green-700 rounded-lg mb-6 border border-green-100">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{success}</p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-gray-600 font-semibold hover:bg-gray-50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || !pastedData.trim()}
            className="px-8 py-2.5 bg-[#e51836] text-white font-bold rounded-lg hover:bg-[#d61632] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/20"
          >
            {uploading ? 'Processing...' : 'Add Students'}
          </button>
        </div>
      </div>
    </div>
  );
}
