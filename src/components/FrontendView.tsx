import { useState, useEffect } from 'react';
import { Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Week, Student, Attendance, AttendanceStatus, Cohort, Programme } from '../types/database';

interface FrontendViewProps {
  onLogoClick: () => void;
}

interface StudentWithAttendanceData extends Student {
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
    if (selectedProgramme !== 'all' && (searchQuery.trim() || selectedCohort !== 'all')) {
      searchStudents();
    } else {
      setStudents([]);
    }
  }, [searchQuery, selectedWeek, selectedCohort, selectedProgramme]);

  const loadWeeks = async () => {
    const { data, error } = await supabase
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
      if (selectedProgramme !== 'all' && !data.find(p => p.id === selectedProgramme)) {
        setSelectedProgramme('all');
      }
    }
  };

  const searchStudents = async () => {
    if (selectedProgramme === 'all') {
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
      .eq('programme_id', selectedProgramme);

    if (searchQuery.trim()) {
      query = query.ilike('name', `%${searchQuery}%`);
    }

    const { data: studentsData, error } = await query;

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

  const getStatusText = (status?: AttendanceStatus) => {
    return status || 'ABSENT';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <img
            src="https://hrccattendance.netlify.app/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Flogohr.b7d53c0a.jpg&w=2048&q=75"
            alt="Logo"
            onClick={onLogoClick}
            className="h-20 mx-auto mb-6 cursor-pointer hover:opacity-80 transition-opacity"
          />

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Week
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Cohort
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Programme
                </label>
                <select
                  value={selectedProgramme}
                  onChange={(e) => setSelectedProgramme(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e51836]"
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
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${selectedProgramme === 'all' ? 'text-gray-300' : 'text-gray-400'}`} />
              <input
                type="text"
                placeholder={selectedProgramme === 'all' ? "Please select a programme first..." : "Search student by name..."}
                disabled={selectedProgramme === 'all'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e51836] disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {loading && (
          <div className="text-center text-gray-600 py-8">Searching...</div>
        )}

        {!loading && students.length > 0 && (
          <div className="space-y-4">
            {students.map((student) => (
              <div
                key={student.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[#091838]">
                      {student.name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {student.programme?.name} - {student.programme?.cohort?.name}
                    </p>
                    <div className="mt-2">
                      <span
                        className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          student.attendance?.status
                        )}`}
                      >
                        {getStatusText(student.attendance?.status)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => markPresent(student.id)}
                    className="ml-4 px-6 py-2 bg-[#e51836] text-white rounded-md hover:bg-[#c41530] focus:outline-none focus:ring-2 focus:ring-[#e51836] focus:ring-offset-2 transition-colors"
                  >
                    Mark Present
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && searchQuery && students.length === 0 && (
          <div className="text-center text-gray-600 py-8">
            No students found matching "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}
