import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Week, Student, Attendance, AttendanceStatus, Cohort, Programme } from '../types/database';

interface FrontendViewProps {
  onLogoClick: () => void;
}

interface StudentWithAttendanceData extends Omit<Student, 'programme'> {
  attendance?: Attendance;
  programme?: {
    name: string;
    cohort?: {
      name: string;
    };
  };
}

export function FrontendView({ onLogoClick }: FrontendViewProps) {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  const [selectedProgramme, setSelectedProgramme] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState<StudentWithAttendanceData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadWeeks();
    loadCohorts();
  }, []);

  useEffect(() => {
    loadProgrammes();
  }, [selectedCohort]);

  useEffect(() => {
    if (selectedCohort !== 'all' && (searchQuery.trim() || selectedCohort !== 'all')) {
      searchStudents();
    } else {
      setStudents([]);
    }
  }, [searchQuery, selectedWeek, selectedCohort, selectedProgramme]);

  const loadWeeks = async () => {
    const { data } = await supabase
      .from('weeks')
      .select('*')
      .order('created_at', { ascending: true });

    if (data) {
      setWeeks(data);
      if (data.length > 0 && !selectedWeek) {
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

      if (selectedProgramme !== 'all' && !data.find(p => p.id === selectedProgramme)) {
        setSelectedProgramme('all');
      }
    }
  };

  const searchStudents = async () => {
    if (selectedCohort === 'all') {
      setStudents([]);
      return;
    }

    setLoading(true);

    let query = supabase
      .from('students')
      .select(`
        *,
        programme:programmes!inner(
          name,
          cohort:cohorts!inner(name)
        )
      `)
      .eq('programme.cohort_id', selectedCohort);

    if (selectedProgramme !== 'all') {
      query = query.eq('programme_id', selectedProgramme);
    }

    if (searchQuery.trim()) {
      query = query.ilike('name', `%${searchQuery}%`);
    }

    const { data: studentsData } = await query;

    if (studentsData) {
      const studentIds = studentsData.map((s) => s.id);

      if (selectedWeek && studentIds.length > 0) {
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
      } else {
        setStudents(studentsData);
      }
    }

    setLoading(false);
  };

  const markPresent = async (studentId: string) => {
    if (!selectedWeek) return;

    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    const currentStatus = student.attendance?.status;
    let newStatus: AttendanceStatus;

    if (currentStatus === 'ONLINE') {
      newStatus = 'HYBRID';
    } else {
      newStatus = 'IN_PERSON';
    }

    const { error } = await supabase
      .from('attendance')
      .upsert({
        student_id: studentId,
        week_id: selectedWeek,
        status: newStatus,
      }, {
        onConflict: 'student_id,week_id',
      });

    if (!error) {
      searchStudents();
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="flex flex-col items-center mb-8 md:mb-12">
          <div className="flex flex-col md:flex-row items-center justify-between w-full gap-4 mb-8">
            <div className="bg-[#091838] p-2 rounded-lg shadow-md w-fit">
              <img
                src="https://hrccattendance.netlify.app/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Flogohr.b7d53c0a.jpg&w=2048&q=75"
                alt="Logo"
                onClick={onLogoClick}
                className="h-10 md:h-12 cursor-pointer hover:opacity-80 transition-opacity"
              />
            </div>
            
            <div className="flex flex-wrap justify-center gap-2 w-full md:w-auto">
              <div className="bg-[#e51836] text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg font-bold text-xs md:text-sm shadow-lg shadow-red-500/20 whitespace-nowrap">
                {weeks.find(w => w.id === selectedWeek)?.name || 'Select Week'}
              </div>
              {selectedProgramme !== 'all' && (
                <div className="bg-[#091838] text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg font-bold text-xs md:text-sm shadow-lg shadow-blue-500/20 whitespace-nowrap">
                  {programmes.find(p => p.id === selectedProgramme)?.name}
                </div>
              )}
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-[#091838] mb-2 tracking-tight text-center">
            Attendance Portal
          </h1>
          <p className="text-gray-500 text-center max-w-md text-sm md:text-base px-2">
            Welcome to the HRCC event. Please search for your name below to mark your attendance.
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl md:rounded-2xl p-4 md:p-8 mb-6 md:mb-8 border border-gray-100">
          <div className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Week
                </label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-white border border-gray-200 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-[#e51836] focus:border-transparent transition-all shadow-sm text-sm"
                >
                  {weeks.map((week) => (
                    <option key={week.id} value={week.id}>
                      {week.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Cohort
                </label>
                <select
                  value={selectedCohort}
                  onChange={(e) => setSelectedCohort(e.target.value)}
                  className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-white border border-gray-200 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-[#e51836] focus:border-transparent transition-all shadow-sm text-sm"
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
                <label className="block text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Programme
                </label>
                <select
                  value={selectedProgramme}
                  onChange={(e) => setSelectedProgramme(e.target.value)}
                  className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-white border border-gray-200 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-[#e51836] focus:border-transparent transition-all shadow-sm text-sm"
                >
                  <option value="all">Select a Programme</option>
                  {programmes.map((programme) => (
                    <option key={programme.id} value={programme.id}>
                      {programme.name} {selectedCohort === 'all' ? `- ${programme.cohort?.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative">
              <Search className={`absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 ${selectedCohort === 'all' ? 'text-gray-300' : 'text-gray-400'}`} />
              <input
                type="text"
                placeholder={selectedCohort === 'all' ? "Select cohort first..." : "Search name..."}
                disabled={selectedCohort === 'all'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-4 bg-white border border-gray-200 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-[#e51836] focus:border-transparent transition-all shadow-sm disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-base md:text-lg"
              />
            </div>
          </div>
        </div>

        {loading && (
          <div className="text-center text-gray-600 py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#e51836] mx-auto mb-2"></div>
            Searching...
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {students.map((student) => (
            <div
              key={student.id}
              className="bg-white border border-gray-100 p-4 md:p-6 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="min-w-0">
                 <h3 className="font-bold text-[#091838] truncate text-base md:text-lg">
                   {student.name}
                 </h3>
                 <p className="text-xs md:text-sm text-gray-500 truncate mb-1">
                   {student.email || 'No email registered'}
                 </p>
                 <div className="flex gap-2 mt-1">
                  <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] md:text-xs font-medium">
                    {student.programme?.name}
                  </span>
                  <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] md:text-xs font-medium">
                    {student.programme?.cohort?.name}
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                <button
                  onClick={() => markPresent(student.id)}
                  disabled={loading}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-md ${
                    student.attendance?.status === 'IN_PERSON'
                      ? 'bg-green-500 text-white shadow-green-500/20'
                      : 'bg-white border-2 border-[#e51836] text-[#e51836] hover:bg-[#e51836] hover:text-white'
                  }`}
                >
                  {student.attendance?.status === 'IN_PERSON' ? 'Present' : 'Mark Present'}
                </button>
                {student.attendance?.status && student.attendance.status !== 'ABSENT' && (
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Status: {student.attendance.status.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {!loading && students.length === 0 && searchQuery && (
          <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400 font-medium">No students found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
