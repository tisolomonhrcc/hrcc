export type ProgrammeType = 'aPHRi' | 'PHRi' | 'SPHRi' | 'UNKNOWN';
export type AttendanceStatus = 'ABSENT' | 'IN_PERSON' | 'ONLINE' | 'HYBRID';

export interface Cohort {
  id: string;
  name: string;
  created_at: string;
}

export interface Programme {
  id: string;
  name: ProgrammeType;
  cohort_id: string;
  created_at: string;
  cohort?: Cohort;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  programme_id: string;
  created_at: string;
  programme?: Programme;
}

export interface Week {
  id: string;
  name: string;
  created_at: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  week_id: string;
  status: AttendanceStatus;
  created_at: string;
  updated_at: string;
  student?: Student;
  week?: Week;
}

export interface StudentWithAttendance extends Student {
  attendance?: Attendance[];
}
