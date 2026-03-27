import { useState, useEffect } from 'react';
import { LogOut, Upload, Plus, Filter, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Week, Programme, Student, Attendance, AttendanceStatus, Cohort } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import { StudentUpload } from './StudentUpload';
import { OnlineAttendanceUpload } from './OnlineAttendanceUpload';

interface AdminPanelProps {
  onNavigateToFrontend: () => void;
}

interface StudentWithDetails extends Student {
  programme?: Programme & {
    cohort?: {
      name: string;
    };
  };
  attendance?: Attendance;
}

export function AdminPanel({ onNavigateToFrontend }: AdminPanelProps) {
  const { signOut } = useAuth();
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  const [selectedProgramme, setSelectedProgramme] = useState<string>('all');
  const [students, setStudents] = useState<StudentWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [showStudentUpload, setShowStudentUpload] = useState(false);
  const [showAttendanceUpload, setShowAttendanceUpload] = useState(false);

  const handleAddWeek = async () => {
    const weekNumber = weeks.length + 1;
    const { data, error } = await supabase
      .from('weeks')
      .insert([{ name: `Week ${weekNumber}` }])
      .select()
      .single();

    if (error) {
      alert('Error adding week: ' + error.message);
      return;
    }

    if (data) {
      setWeeks([...weeks, data]);
      setSelectedWeek(data.id);
    }
  };

  const handleAddCohort = async () => {
    const cohortName = window.prompt('Enter cohort name (e.g. Cohort 47):');
    if (!cohortName) return;

    const { data: cohort, error: cohortError } = await supabase
      .from('cohorts')
      .insert([{ name: cohortName }])
      .select()
      .single();

    if (cohortError) {
      alert('Error adding cohort: ' + cohortError.message);
      return;
    }

    if (cohort) {
      // Create default programmes for the new cohort
      const { error: programmesError } = await supabase
        .from('programmes')
        .insert([
          { name: 'aPHRi', cohort_id: cohort.id },
          { name: 'PHRi', cohort_id: cohort.id },
          { name: 'SPHRi', cohort_id: cohort.id },
        ]);

      if (programmesError) {
        alert('Error adding programmes for cohort: ' + programmesError.message);
        return;
      }

      await loadProgrammes();
      alert(`Successfully added ${cohortName} and its default programmes.`);
    }
  };

  const handleDeleteCohort = async () => {
    if (selectedCohort === 'all') {
      alert('Please select a specific cohort to delete.');
      return;
    }

    const cohort = cohorts.find(c => c.id === selectedCohort);
    if (!cohort) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${cohort.name}"? This will delete all associated programmes, students, and attendance records. This action cannot be undone.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from('cohorts')
      .delete()
      .eq('id', selectedCohort);

    if (error) {
      alert('Error deleting cohort: ' + error.message);
      return;
    }

    alert(`Successfully deleted ${cohort.name}.`);
    setSelectedCohort('all');
    loadCohorts();
  };

  useEffect(() => {
    loadWeeks();
    loadCohorts();
  }, []);

  useEffect(() => {
    loadProgrammes();
  }, [selectedCohort]);

  useEffect(() => {
    if (selectedWeek) {
      loadStudents();
    }
  }, [selectedWeek, selectedProgramme, selectedCohort]);

  const loadWeeks = async () => {
    const { data } = await supabase
      .from('weeks')
      .select('*')
      .order('created_at', { ascending: true });

    if (data) {
      setWeeks(data);
      if (data.length > 0) {
        setSelectedWeek(data[data.length - 1].id); // Select the latest week by default
      }
    }
  };

  const loadCohorts = async () => {
    const { data } = await supabase
      .from('cohorts')
      .select('*')
      .order('name', { ascending: false });

    if (data) {
      setCohorts(data);
    }
  };

  const loadProgrammes = async () => {
    let query = supabase
      .from('programmes')
      .select(`
        *,
        cohort:cohorts(name)
      `)
      .order('created_at', { ascending: true });

    if (selectedCohort !== 'all') {
      query = query.eq('cohort_id', selectedCohort);
    }

    const { data } = await query;

    if (data) {
      setProgrammes(data);
      // Reset programme selection if current selection is not in the new list
      if (selectedProgramme !== 'all' && !data.find(p => p.id === selectedProgramme)) {
        setSelectedProgramme('all');
      }
    }
  };

  const loadStudents = async () => {
    setLoading(true);

    let query = supabase
      .from('students')
      .select(`
        *,
        programme:programmes!inner(
          *,
          cohort:cohorts!inner(name)
        )
      `)
      .order('name', { ascending: true });

    if (selectedCohort !== 'all') {
      query = query.eq('programme.cohort_id', selectedCohort);
    }

    if (selectedProgramme !== 'all') {
      query = query.eq('programme_id', selectedProgramme);
    }

    const { data: studentsData } = await query;

    if (studentsData && selectedWeek) {
      const studentIds = studentsData.map((s) => s.id);

      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .eq('week_id', selectedWeek)
        .in('student_id', studentIds);

      const studentsWithAttendance = studentsData.map((student) => ({
        ...student,
        attendance: attendanceData?.find((a) => a.student_id === student.id),
      }));

      setStudents(studentsWithAttendance);
    }

    setLoading(false);
  };

  const updateAttendance = async (studentId: string, status: AttendanceStatus) => {
    if (!selectedWeek) return;

    await supabase
      .from('attendance')
      .upsert({
        student_id: studentId,
        week_id: selectedWeek,
        status,
      }, {
        onConflict: 'student_id,week_id',
      });

    loadStudents();
  };

  const getStatusColor = (status?: AttendanceStatus) => {
    switch (status) {
      case 'IN_PERSON':
        return 'bg-green-100 text-green-800';
      case 'ONLINE':
        return 'bg-blue-100 text-blue-800';
      case 'HYBRID':
        return 'bg-purple-100 text-purple-800';
      case 'ABSENT':
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <img
              src="https://hrccattendance.netlify.app/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Flogohr.b7d53c0a.jpg&w=2048&q=75"
              alt="Logo"
              className="h-16 cursor-pointer hover:opacity-80 transition-opacity"
            />
            <div className="flex items-center gap-4">
              <button
                onClick={onNavigateToFrontend}
                className="px-4 py-2 text-[#091838] hover:text-[#e51836] transition-colors"
              >
                Frontend View
              </button>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 px-4 py-2 bg-[#e51836] text-white rounded-md hover:bg-[#c41530] transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-[#091838] mb-6">Admin Panel</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Select Week
                </label>
                <button
                  onClick={handleAddWeek}
                  className="flex items-center gap-1 text-xs font-medium text-[#e51836] hover:text-[#c41530] transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add Week
                </button>
              </div>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e51836]"
              >
                {weeks.map((week) => (
                  <option key={week.id} value={week.id}>
                    {week.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Cohort
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddCohort}
                    className="flex items-center gap-1 text-xs font-medium text-[#e51836] hover:text-[#c41530] transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                  {selectedCohort !== 'all' && (
                    <button
                      onClick={handleDeleteCohort}
                      title="Delete current cohort"
                      className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <select
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e51836]"
              >
                <option value="all">All Cohorts</option>
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Programme
                </label>
              </div>
              <select
                value={selectedProgramme}
                onChange={(e) => setSelectedProgramme(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e51836]"
              >
                <option value="all">All Programmes</option>
                {programmes.map((programme) => (
                  <option key={programme.id} value={programme.id}>
                    {programme.name} {selectedCohort === 'all' ? `- ${programme.cohort?.name}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={() => setShowStudentUpload(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#d1ad73] text-white rounded-md hover:bg-[#b89555] transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload Students
              </button>
              <button
                onClick={() => setShowAttendanceUpload(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#091838] text-white rounded-md hover:bg-[#0a1f4a] transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload Attendance
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-600 py-8">Loading students...</div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Programme
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.programme?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                            student.attendance?.status
                          )}`}
                        >
                          {student.attendance?.status || 'ABSENT'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => updateAttendance(student.id, 'ABSENT')}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Absent
                        </button>
                        <button
                          onClick={() => updateAttendance(student.id, 'IN_PERSON')}
                          className="text-green-600 hover:text-green-900"
                        >
                          In-Person
                        </button>
                        <button
                          onClick={() => updateAttendance(student.id, 'ONLINE')}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Online
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showStudentUpload && (
        <StudentUpload
          programmes={programmes}
          onClose={() => setShowStudentUpload(false)}
          onSuccess={() => {
            setShowStudentUpload(false);
            loadStudents();
          }}
        />
      )}

      {showAttendanceUpload && selectedWeek && (
        <OnlineAttendanceUpload
          weekId={selectedWeek}
          onClose={() => setShowAttendanceUpload(false)}
          onSuccess={() => {
            setShowAttendanceUpload(false);
            loadStudents();
          }}
        />
      )}
    </div>
  );
}
