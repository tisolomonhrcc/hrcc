import { useState } from 'react';
import { X, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { Programme } from '../types/database';

interface StudentUploadProps {
  programmes: Programme[];
  onClose: () => void;
  onSuccess: () => void;
}

interface StudentRow {
  name: string;
  email: string | null;
}

export function StudentUpload({ programmes, onClose, onSuccess }: StudentUploadProps) {
  const [selectedProgramme, setSelectedProgramme] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedProgramme) {
      setError('Please select a programme and upload a file');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

      const students: StudentRow[] = [];
      const seenEmailsInFile = new Set<string>();

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (row[0]) {
          const name = String(row[0]).trim();
          const email = row[1] ? String(row[1]).trim().toLowerCase() : null;
          
          if (name) {
            // Only check for duplicates if email is provided
            if (email && seenEmailsInFile.has(email)) continue;
            
            students.push({ name, email });
            if (email) seenEmailsInFile.add(email);
          }
        }
      }

      if (students.length === 0) {
        setError('No valid students found in the file');
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
      const duplicateCount = (jsonData.filter(r => r[0]).length) - newStudents.length;

      if (newStudents.length === 0) {
        setError(`All students in this file are already registered (${duplicateCount} duplicates skipped)`);
        setUploading(false);
        return;
      }

      const studentsToInsert = newStudents.map((student) => ({
        name: student.name,
        email: student.email,
        programme_id: selectedProgramme,
      }));

      const { error: insertError } = await supabase
        .from('students')
        .insert(studentsToInsert);

      if (insertError) {
        throw insertError;
      }

      setSuccess(`Successfully uploaded ${newStudents.length} new students. ${duplicateCount > 0 ? `${duplicateCount} duplicates were skipped.` : ''}`);
      setTimeout(() => {
        onSuccess();
      }, 2500);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload students');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-xl font-bold text-[#091838]">Upload Students</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Programme
            </label>
            <select
              value={selectedProgramme}
              onChange={(e) => setSelectedProgramme(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e51836]"
            >
              <option value="">Choose a programme...</option>
              {programmes.map((programme) => (
                <option key={programme.id} value={programme.id}>
                  {programme.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Excel File
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#e51836] transition-colors">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">
                  {file ? file.name : 'Click to upload Excel file'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Column A: Name, Column B: Email
                </p>
              </label>
            </div>
          </div>

          {error && (
            <div className="text-sm text-[#e51836] bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="text-sm text-green-700 bg-green-50 p-3 rounded-md">
              {success}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading || !file || !selectedProgramme}
            className="w-full px-4 py-2 bg-[#e51836] text-white rounded-md hover:bg-[#c41530] focus:outline-none focus:ring-2 focus:ring-[#e51836] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'Uploading...' : 'Upload Students'}
          </button>
        </div>
      </div>
    </div>
  );
}
