import { useState, useEffect } from 'react';
import { X, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import Fuse from 'fuse.js';
import { supabase } from '../lib/supabase';
import { Student, AttendanceStatus } from '../types/database';

interface OnlineAttendanceUploadProps {
  weekId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface UnmatchedStudent {
  name: string;
  suggestions: Student[];
}

export function OnlineAttendanceUpload({
  weekId,
  onClose,
  onSuccess,
}: OnlineAttendanceUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [unmatchedStudents, setUnmatchedStudents] = useState<UnmatchedStudent[]>([]);
  const [selectedMatches, setSelectedMatches] = useState<{ [key: string]: string }>({});
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  useEffect(() => {
    loadAllStudents();
  }, []);

  const loadAllStudents = async () => {
    const { data } = await supabase
      .from('students')
      .select('*')
      .order('name', { ascending: true });

    if (data) {
      setAllStudents(data);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  };

  const findMatches = (name: string, students: Student[]): Student[] => {
    // Basic normalization: trim and convert to lowercase
    const normalizedName = name.trim().toLowerCase();
    
    // First, try to find an exact match or a substring match among all students
    const potentialMatches = students.filter(s => {
      const studentName = s.name.toLowerCase();
      return studentName === normalizedName || 
             studentName.includes(normalizedName) || 
             normalizedName.includes(studentName);
    });

    if (potentialMatches.length > 0) {
      return potentialMatches.slice(0, 3);
    }

    const fuse = new Fuse(students, {
      keys: ['name'],
      threshold: 0.4,
      distance: 100,
    });

    const results = fuse.search(name);
    return results.slice(0, 3).map((result) => result.item);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please upload a file');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');
    setUnmatchedStudents([]);
    setCurrentPage(1);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

      const names: string[] = [];
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (row[0]) {
          names.push(String(row[0]).trim());
        }
      }

      if (names.length === 0) {
        setError('No names found in the file');
        setUploading(false);
        return;
      }

      const unmatched: UnmatchedStudent[] = [];
      const matchedStudents: Student[] = [];

      for (const name of names) {
        const normalizedName = name.trim().toLowerCase();
        
        // Better exact matching: check for exact match or name containing/contained by
        const exactMatch = allStudents.find(
          (s) => {
            const studentName = s.name.toLowerCase();
            return studentName === normalizedName || 
                   studentName.split(' ').some(part => part === normalizedName) ||
                   normalizedName.split(' ').some(part => part === studentName);
          }
        );

        if (exactMatch) {
          matchedStudents.push(exactMatch);
        } else {
          const suggestions = findMatches(name, allStudents);
          if (suggestions.length > 0) {
            unmatched.push({ name, suggestions });
          } else {
            // Even if no fuzzy matches, still add to unmatched for manual lookup
            unmatched.push({ name, suggestions: [] });
          }
        }
      }

      for (const student of matchedStudents) {
        const { data: existingAttendance } = await supabase
          .from('attendance')
          .select('*')
          .eq('student_id', student.id)
          .eq('week_id', weekId)
          .maybeSingle();

        let newStatus: AttendanceStatus = 'ONLINE';

        // If they were already marked as IN_PERSON, mark them as HYBRID
        if (existingAttendance?.status === 'IN_PERSON') {
          newStatus = 'HYBRID';
        } else if (existingAttendance?.status === 'HYBRID') {
          newStatus = 'HYBRID';
        }

        await supabase
          .from('attendance')
          .upsert({
            student_id: student.id,
            week_id: weekId,
            status: newStatus,
          }, {
            onConflict: 'student_id,week_id',
          });
      }

      if (unmatched.length > 0) {
        setUnmatchedStudents(unmatched);
        setSuccess(
          `Processed ${matchedStudents.length} students. ${unmatched.length} require manual matching.`
        );
      } else {
        setSuccess(`Successfully updated attendance for ${matchedStudents.length} students`);
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process attendance');
    } finally {
      setUploading(false);
    }
  };

  const handleManualMatch = async () => {
    setUploading(true);

    try {
      for (const [, studentId] of Object.entries(selectedMatches)) {
        if (!studentId) continue;

        const { data: existingAttendance } = await supabase
          .from('attendance')
          .select('*')
          .eq('student_id', studentId)
          .eq('week_id', weekId)
          .maybeSingle();

        let newStatus: AttendanceStatus = 'ONLINE';

        if (existingAttendance?.status === 'IN_PERSON') {
          newStatus = 'HYBRID';
        } else if (existingAttendance?.status === 'HYBRID') {
          newStatus = 'HYBRID';
        }

        await supabase
          .from('attendance')
          .upsert({
            student_id: studentId,
            week_id: weekId,
            status: newStatus,
          }, {
            onConflict: 'student_id,week_id',
          });
      }

      setSuccess('Successfully matched and updated attendance');
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update attendance');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-xl font-bold text-[#091838]">Upload Online Attendance</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {unmatchedStudents.length === 0 ? (
            <>
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
                    id="attendance-file-upload"
                  />
                  <label htmlFor="attendance-file-upload" className="cursor-pointer">
                    <Upload className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      {file ? file.name : 'Click to upload Excel file'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Column A: Student Names</p>
                  </label>
                </div>
              </div>

              {error && (
                <div className="text-sm text-[#e51836] bg-red-50 p-3 rounded-md">{error}</div>
              )}

              {success && (
                <div className="text-sm text-green-700 bg-green-50 p-3 rounded-md">
                  {success}
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={uploading || !file}
                className="w-full px-4 py-2 bg-[#e51836] text-white rounded-md hover:bg-[#c41530] focus:outline-none focus:ring-2 focus:ring-[#e51836] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? 'Processing...' : 'Upload Attendance'}
              </button>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-[#091838]">
                    Match Unrecognized Names ({unmatchedStudents.length})
                  </h4>
                  <span className="text-sm text-gray-500">
                    Page {currentPage} of {Math.ceil(unmatchedStudents.length / itemsPerPage)}
                  </span>
                </div>
                {unmatchedStudents
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map((unmatched, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <p className="font-medium text-gray-900 mb-2">
                        "{unmatched.name}" not found
                      </p>
                      <label className="block text-sm text-gray-700 mb-2">
                        Select matching student:
                      </label>
                      <select
                        value={selectedMatches[unmatched.name] || ''}
                        onChange={(e) =>
                          setSelectedMatches({
                            ...selectedMatches,
                            [unmatched.name]: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e51836]"
                      >
                        <option value="">Skip this student</option>
                        {unmatched.suggestions.length > 0 ? (
                          unmatched.suggestions.map((student) => (
                            <option key={student.id} value={student.id}>
                              {student.name} ({student.email})
                            </option>
                          ))
                        ) : (
                          <optgroup label="Search for a student">
                            {allStudents.map((student) => (
                              <option key={student.id} value={student.id}>
                                {student.name} ({student.email})
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  ))}
                
                {unmatchedStudents.length > itemsPerPage && (
                  <div className="flex justify-between items-center pt-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(unmatchedStudents.length / itemsPerPage), prev + 1))}
                      disabled={currentPage === Math.ceil(unmatchedStudents.length / itemsPerPage)}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="text-sm text-[#e51836] bg-red-50 p-3 rounded-md">{error}</div>
              )}

              {success && (
                <div className="text-sm text-green-700 bg-green-50 p-3 rounded-md">
                  {success}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleManualMatch}
                  disabled={uploading}
                  className="flex-1 px-4 py-2 bg-[#e51836] text-white rounded-md hover:bg-[#c41530] focus:outline-none focus:ring-2 focus:ring-[#e51836] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {uploading ? 'Updating...' : 'Confirm Matches'}
                </button>
                <button
                  onClick={onSuccess}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Skip & Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
