import { useState } from 'react';
import { X, Copy, CheckCircle2 } from 'lucide-react';
import { Student } from '../types/database';

interface FrequentAbsenteesModalProps {
  students: (Student & { absentCount?: number })[];
  onClose: () => void;
}

export function FrequentAbsenteesModal({ students, onClose }: FrequentAbsenteesModalProps) {
  const [copied, setCopied] = useState(false);
  const absentStudents = students
    .filter(s => (s.absentCount || 0) >= 3)
    .sort((a, b) => (b.absentCount || 0) - (a.absentCount || 0));

  const handleCopy = () => {
    const text = absentStudents.map(s => `${s.name} (${s.absentCount} absences)`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 relative flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#091838]">Students with 3+ Absences</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg p-4 mb-4">
          {absentStudents.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No students with 3 or more absences found in the current view.</p>
          ) : (
            <ul className="space-y-2">
              {absentStudents.map(student => (
                <li key={student.id} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0">
                  <span className="font-medium text-gray-800">{student.name}</span>
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                    {student.absentCount} absences
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors font-medium">
            Close
          </button>
          <button
            onClick={handleCopy}
            disabled={absentStudents.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#091838] text-white rounded-lg hover:bg-[#0a1f4a] transition-colors disabled:opacity-50 font-medium"
          >
            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Names'}
          </button>
        </div>
      </div>
    </div>
  );
}
