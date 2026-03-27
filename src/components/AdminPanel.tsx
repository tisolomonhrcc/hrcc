import { useState, useEffect } from 'react';
import { LogOut, Upload, Plus, Trash2, Users, UserCheck, Globe, UserX, Clipboard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Week, Programme, Student, Attendance, AttendanceStatus, Cohort } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import { StudentUpload } from './StudentUpload';
import { OnlineAttendanceUpload } from './OnlineAttendanceUpload';
import { PasteStudents } from './PasteStudents';

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
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [showStudentUpload, setShowStudentUpload] = useState(false);
  const [showPasteUpload, setShowPasteUpload] = useState(false);
  const [showAttendanceUpload, setShowAttendanceUpload] = useState(false);

  const stats = {
    total: students.length,
    inPerson: students.filter(s => s.attendance?.status === 'IN_PERSON' || s.attendance?.status === 'HYBRID').length,
    online: students.filter(s => s.attendance?.status === 'ONLINE').length,
    absent: students.filter(s => !s.attendance || s.attendance.status === 'ABSENT').length,
  };

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
          { name: 'Mentorship', cohort_id: cohort.id },
        ]);

      if (programmesError) {
        alert('Error adding programmes for cohort: ' + programmesError.message);
        return;
      }

      await loadCohorts(); // Refresh cohort list first
      setSelectedCohort(cohort.id); // This will trigger loadProgrammes and auto-select Mentorship if name matches
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
    setSelectedStudentIds(new Set()); // Reset selection when filters change
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
      
      // Auto-select Mentorship if cohort name contains "mentorship"
      if (selectedCohort !== 'all') {
        const cohort = cohorts.find(c => c.id === selectedCohort);
        if (cohort?.name.toLowerCase().includes('mentorship')) {
          const mentorshipProg = data.find(p => p.name.toLowerCase() === 'mentorship');
          if (mentorshipProg) {
            console.log('Auto-selecting Mentorship programme for cohort:', cohort.name);
            setSelectedProgramme(mentorshipProg.id);
            return;
          }
        }
      }

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

  const changeProgramme = async (studentId: string, newProgrammeId: string) => {
    if (!newProgrammeId) return;

    const { error } = await supabase
      .from('students')
      .update({ programme_id: newProgrammeId })
      .eq('id', studentId);

    if (error) {
      alert('Error changing programme: ' + error.message);
      return;
    }

    loadStudents();
  };

  const deleteStudent = async (studentId: string, studentName: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete student "${studentName}"? This will also remove all their attendance records.`);
    if (!confirmed) return;

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', studentId);

    if (error) {
      alert('Error deleting student: ' + error.message);
      return;
    }

    loadStudents();
  };

  const toggleSelectAll = () => {
    if (selectedStudentIds.size === students.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(students.map(s => s.id)));
    }
  };

  const toggleStudentSelection = (id: string) => {
    const newSelected = new Set(selectedStudentIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedStudentIds(newSelected);
  };

  const deleteSelectedStudents = async () => {
    if (selectedStudentIds.size === 0) return;

    let filterText = `${selectedStudentIds.size} selected students`;
    if (selectedStudentIds.size === students.length) {
      if (selectedCohort !== 'all') {
        const cohort = cohorts.find(c => c.id === selectedCohort);
        filterText = `all students in "${cohort?.name}"`;
        if (selectedProgramme !== 'all') {
          const programme = programmes.find(p => p.id === selectedProgramme);
          filterText = `all students in "${programme?.name}" (${cohort?.name})`;
        }
      } else {
        filterText = "all students";
      }
    }

    const confirmed = window.confirm(
      `DANGER: Are you sure you want to delete ${filterText}? This will permanently remove ${selectedStudentIds.size} students and all their attendance records. This action CANNOT be undone.`
    );
    
    if (!confirmed) return;

    const secondConfirmed = window.confirm(
      `FINAL WARNING: You are about to delete ${selectedStudentIds.size} students. Are you absolutely sure?`
    );

    if (!secondConfirmed) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .in('id', Array.from(selectedStudentIds));

      if (error) throw error;

      alert(`Successfully deleted ${selectedStudentIds.size} students.`);
      setSelectedStudentIds(new Set());
      loadStudents();
    } catch (error: any) {
      alert('Error deleting students: ' + error.message);
    } finally {
      setLoading(false);
      // Wait a moment for database consistency
      setTimeout(() => loadStudents(), 500);
    }
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
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="bg-white rounded-xl shadow-md p-4 md:p-8 mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#091838]">Admin Dashboard</h1>
              <p className="text-gray-500 text-sm">Manage students and track attendance</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={onNavigateToFrontend}
                className="flex-1 md:flex-none px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              >
                Go to Frontend
              </button>
              <button
                onClick={signOut}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#e51836] rounded-lg hover:bg-[#c41530] transition-colors shadow-lg shadow-red-500/20"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="grid grid-cols-1 gap-4 sm:col-span-2 lg:col-span-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Week
                    </label>
                    <button
                      onClick={handleAddWeek}
                      className="flex items-center gap-1 text-[10px] font-bold text-[#e51836] hover:text-[#c41530] transition-colors uppercase"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </button>
                  </div>
                  <select
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e51836] focus:border-transparent transition-all text-sm"
                  >
                    {weeks.map((week) => (
                      <option key={week.id} value={week.id}>
                        {week.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Cohort
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAddCohort}
                        className="flex items-center gap-1 text-[10px] font-bold text-[#e51836] hover:text-[#c41530] transition-colors uppercase"
                      >
                        <Plus className="w-3 h-3" />
                        Add
                      </button>
                      {selectedCohort !== 'all' && (
                        <button
                          onClick={handleDeleteCohort}
                          title="Delete current cohort"
                          className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors uppercase"
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
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e51836] focus:border-transparent transition-all text-sm"
                  >
                    <option value="all">All Cohorts</option>
                    {cohorts.map((cohort) => (
                      <option key={cohort.id} value={cohort.id}>
                        {cohort.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Programme
                    </label>
                  </div>
                  <select
                    value={selectedProgramme}
                    onChange={(e) => setSelectedProgramme(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e51836] focus:border-transparent transition-all text-sm"
                  >
                    <option value="all">All Programmes</option>
                    {programmes.map((programme) => (
                      <option key={programme.id} value={programme.id}>
                        {programme.name} {selectedCohort === 'all' ? `- ${programme.cohort?.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-2">
              <button
                onClick={() => setShowStudentUpload(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm bg-[#d1ad73] text-white rounded-lg hover:bg-[#b89555] transition-colors shadow-sm"
              >
                <Upload className="w-4 h-4" />
                Upload Students
              </button>
              <button
                onClick={() => setShowPasteUpload(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm bg-[#091838] text-white rounded-lg hover:bg-[#0a1f4a] transition-colors shadow-sm"
              >
                <Clipboard className="w-4 h-4" />
                Paste Students
              </button>
              <button
                onClick={() => setShowAttendanceUpload(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm bg-[#091838] text-white rounded-lg hover:bg-[#0a1f4a] transition-colors shadow-sm"
              >
                <Upload className="w-4 h-4" />
                Upload Attendance
              </button>
              {selectedStudentIds.size > 0 && (
                <button
                  onClick={deleteSelectedStudents}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete ({selectedStudentIds.size})
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-8">
            <div className="bg-white rounded-xl border border-gray-100 p-3 md:p-6 flex items-center gap-3 md:gap-4 shadow-sm">
              <div className="p-2 md:p-3 bg-blue-50 rounded-lg shrink-0">
                <Users className="w-4 h-4 md:w-6 md:h-6 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-sm text-gray-500 font-medium uppercase tracking-wider">Total</p>
                <h3 className="text-lg md:text-2xl font-bold text-gray-900 truncate">{stats.total}</h3>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3 md:p-6 flex items-center gap-3 md:gap-4 shadow-sm">
              <div className="p-2 md:p-3 bg-green-50 rounded-lg shrink-0">
                <UserCheck className="w-4 h-4 md:w-6 md:h-6 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-sm text-gray-500 font-medium uppercase tracking-wider">In Person</p>
                <h3 className="text-lg md:text-2xl font-bold text-gray-900 truncate">{stats.inPerson}</h3>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3 md:p-6 flex items-center gap-3 md:gap-4 shadow-sm">
              <div className="p-2 md:p-3 bg-purple-50 rounded-lg shrink-0">
                <Globe className="w-4 h-4 md:w-6 md:h-6 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-sm text-gray-500 font-medium uppercase tracking-wider">Online</p>
                <h3 className="text-lg md:text-2xl font-bold text-gray-900 truncate">{stats.online}</h3>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3 md:p-6 flex items-center gap-3 md:gap-4 shadow-sm">
              <div className="p-2 md:p-3 bg-red-50 rounded-lg shrink-0">
                <UserX className="w-4 h-4 md:w-6 md:h-6 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-sm text-gray-500 font-medium uppercase tracking-wider">Absent</p>
                <h3 className="text-lg md:text-2xl font-bold text-gray-900 truncate">{stats.absent}</h3>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#e51836] border-t-transparent"></div>
              <p className="mt-2 text-gray-500 text-sm">Loading students...</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left w-10">
                        <input
                          type="checkbox"
                          checked={students.length > 0 && selectedStudentIds.size === students.length}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 text-[#e51836] focus:ring-[#e51836]"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Student
                      </th>
                      <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Programme
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {students.map((student) => (
                      <tr key={student.id} className={`hover:bg-gray-50 transition-colors ${selectedStudentIds.has(student.id) ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.has(student.id)}
                            onChange={() => toggleStudentSelection(student.id)}
                            className="rounded border-gray-300 text-[#e51836] focus:ring-[#e51836]"
                          />
                        </td>
                        <td className="px-4 py-4">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#091838] truncate">{student.name}</p>
                          <p className="text-[10px] text-gray-500 truncate">{student.email || 'No email'}</p>
                        </div>
                      </td>
                        <td className="hidden md:table-cell px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          <select
                            value={student.programme_id}
                            onChange={(e) => changeProgramme(student.id, e.target.value)}
                            className="px-2 py-1 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#e51836] text-xs"
                          >
                            {programmes
                              .filter(p => p.cohort_id === student.programme?.cohort_id)
                              .map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                          </select>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getStatusColor(student.attendance?.status)}`}>
                            {student.attendance?.status || 'ABSENT'}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => updateAttendance(student.id, 'ABSENT')}
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors"
                              title="Mark Absent"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => updateAttendance(student.id, 'IN_PERSON')}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Mark In Person"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => updateAttendance(student.id, 'ONLINE')}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Mark Online"
                            >
                              <Globe className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteStudent(student.id, student.name)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete student"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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

        {showPasteUpload && (
          <PasteStudents
            onClose={() => setShowPasteUpload(false)}
            onSuccess={() => {
              setShowPasteUpload(false);
              loadStudents();
            }}
            selectedProgramme={selectedProgramme}
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
    </div>
  );
}
